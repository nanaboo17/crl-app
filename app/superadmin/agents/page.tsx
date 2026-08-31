import Link from 'next/link'
import {
  AlertCircle,
  Inbox,
  Pencil,
  UserPlus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'

const PAGE_SIZE = 10

export default async function ManageAgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const supabase = await createClient()

  const { data: agents, error, count } = await supabase
    .from('agents')
    .select('email, agent_name, sales_code, role, active', {
      count: 'exact',
    })
    .order('agent_name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (error) {
    console.error('superadmin/agents:', error.message)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <SuperadminPageHeader
          breadcrumbs={[
            { label: 'Superadmin', href: '/superadmin' },
            { label: 'Agents' },
          ]}
          title="Agents"
          description="Manage agent accounts and access."
        />
        <SuperadminState
          tone="error"
          icon={AlertCircle}
          title="Unable to load agents"
          description="Please try again."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: 'Agents' },
        ]}
        title="Agents"
        description="Manage agent accounts and access."
        actions={
          <Link href="/superadmin/agents/new" className="btn btn-primary btn-sm">
            <UserPlus aria-hidden="true" className="size-4" />
            Add Agent
          </Link>
        }
      />

      {agents.length === 0 ? (
        <SuperadminState
          icon={Inbox}
          title="No agents found"
          description="There are currently no agent records to display."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
            <table className="table table-sm table-zebra">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="hidden sm:table-cell">Sales Code</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.email} className="hover:bg-base-200/50">
                    <td>
                      <Link
                        href={`/superadmin/agents/${encodeURIComponent(agent.email)}`}
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
                      <span className="badge badge-sm badge-ghost capitalize">
                        {agent.role}
                      </span>
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
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/superadmin/agents/${encodeURIComponent(agent.email)}`}
                          aria-label={`Edit ${agent.agent_name}`}
                          title="Edit agent"
                          className="btn btn-ghost btn-sm btn-square"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
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
            total={count ?? 0}
            basePath="/superadmin/agents"
          />
        </>
      )}
    </div>
  )
}
