import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertCircle,
  Eye,
  Inbox,
  MapPin,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'

const PAGE_SIZE = 10

export default async function SuperadminVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const email = user.email.trim().toLowerCase()

  const { data: currentUser } = await supabase
    .from('agents')
    .select('role, active')
    .eq('email', email)
    .maybeSingle()

  if (
    !currentUser ||
    !currentUser.active ||
    !['superadmin'].includes(currentUser.role)
  ) {
    redirect('/auth/route')
  }

  const { data: agents, error, count: totalAgents } = await supabase
    .from('agents')
    .select(
      `
      email,
      agent_name,
      sales_code,
      active
    `,
      { count: 'exact' }
    )
    .eq('role', 'agent')
    .order('agent_name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (error) {
    console.error('superadmin/visits:', error.message)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <SuperadminPageHeader
          breadcrumbs={[
            { label: 'Superadmin', href: '/superadmin' },
            { label: 'Visits' },
          ]}
          title="Visit Monitoring"
          description="Select an agent to review visit activity."
        />
        <SuperadminState
          tone="error"
          icon={AlertCircle}
          title="Unable to load visits"
          description="Please try again."
        />
      </div>
    )
  }

  const [agentData, totalVisitsResult] = await Promise.all([
    Promise.all(
      (agents ?? []).map(async (agent) => {
        const { count } = await supabase
          .from('visits')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('agent_email', agent.email)

        return {
          ...agent,
          visit_count: count ?? 0,
        }
      })
    ),
    supabase.from('visits').select('*', { count: 'exact', head: true }),
  ])

  const totalVisits = totalVisitsResult.count ?? 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: 'Visits' },
        ]}
        title="Visit Monitoring"
        description="Select an agent to review visit activity."
      />

      <div className="stats w-full border border-base-300 bg-base-100">
        <div className="stat">
          <div className="stat-figure text-base-content/25">
            <Users aria-hidden="true" className="size-6" />
          </div>
          <div className="stat-title">Total Agents</div>
          <div className="stat-value text-3xl">{totalAgents ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat-figure text-base-content/25">
            <MapPin aria-hidden="true" className="size-6" />
          </div>
          <div className="stat-title">Total Visits</div>
          <div className="stat-value text-3xl">{totalVisits}</div>
        </div>
      </div>

      {agents.length === 0 ? (
        <SuperadminState
          icon={Inbox}
          title="No agents found"
          description="Visit activity will appear once agents are registered."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
            <table className="table table-sm table-zebra">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="hidden sm:table-cell">Sales Code</th>
                  <th>Status</th>
                  <th>Visits</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {agentData.map((agent) => (
                  <tr key={agent.email} className="hover:bg-base-200/50">
                    <td>
                      <Link
                        href={`/superadmin/visits/${encodeURIComponent(
                          agent.email
                        )}`}
                        className="flex flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content"
                      >
                        <span className="font-semibold text-base-content">
                          {agent.agent_name}
                        </span>
                        <span className="text-xs text-base-content/60">
                          {agent.email}
                        </span>
                      </Link>
                    </td>
                    <td className="hidden sm:table-cell">
                      {agent.sales_code || '-'}
                    </td>
                    <td>
                      <span
                        className={`badge badge-sm badge-outline ${
                          agent.active ? 'badge-success' : 'badge-error'
                        }`}
                      >
                        {agent.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="font-medium tabular-nums">
                      {agent.visit_count}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/superadmin/visits/${encodeURIComponent(
                            agent.email
                          )}`}
                          aria-label={`View visits for ${agent.agent_name}`}
                          title="View visits"
                          className="btn btn-ghost btn-sm btn-square"
                        >
                          <Eye aria-hidden="true" className="size-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SuperadminPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={totalAgents ?? 0}
            basePath="/superadmin/visits"
          />
        </>
      )}
    </div>
  )
}
