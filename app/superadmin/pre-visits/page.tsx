import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertCircle,
  ClipboardList,
  Eye,
  Inbox,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

const PAGE_SIZE = 10

export default async function AdminPreVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, allMessages, key, params)

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
    !['admin', 'superadmin'].includes(currentUser.role)
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
    console.error('superadmin/pre-visits:', error.message)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <SuperadminPageHeader
          breadcrumbs={[
            { label: t('superadmin.bc.superadmin'), href: '/superadmin', icon: ShieldCheck },
            { label: t('superadmin.bc.preVisits'), icon: ClipboardList },
          ]}
          title={t('superadmin.preVisits.title')}
          description={t('superadmin.preVisits.description')}
        />
        <SuperadminState
          tone="error"
          icon={AlertCircle}
          title={t('superadmin.preVisits.errorTitle')}
          description={t('superadmin.preVisits.errorDesc')}
        />
      </div>
    )
  }

  const [agentData, totalPreVisitsResult] = await Promise.all([
    Promise.all(
      (agents ?? []).map(async (agent) => {
        const { count } = await supabase
          .from('pre_visits')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('agent_email', agent.email)

        return {
          ...agent,
          previsit_count: count ?? 0,
        }
      })
    ),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }),
  ])

  const totalPreVisits = totalPreVisitsResult.count ?? 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: t('superadmin.bc.superadmin'), href: '/superadmin' },
          { label: t('superadmin.bc.preVisits') },
        ]}
        title={t('superadmin.preVisits.title')}
        description={t('superadmin.preVisits.description')}
      />

      <div className="stats w-full border border-base-300 bg-base-100">
        <div className="stat">
          <div className="stat-figure text-base-content/25">
            <Users aria-hidden="true" className="size-6" />
          </div>
          <div className="stat-title">{t('superadmin.preVisits.totalAgents')}</div>
          <div className="stat-value text-3xl">{totalAgents ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat-figure text-base-content/25">
            <ClipboardList aria-hidden="true" className="size-6" />
          </div>
          <div className="stat-title">{t('superadmin.preVisits.totalPreVisits')}</div>
          <div className="stat-value text-3xl">{totalPreVisits}</div>
        </div>
      </div>

      {agents.length === 0 ? (
        <SuperadminState
          icon={Inbox}
          title={t('superadmin.preVisits.emptyTitle')}
          description={t('superadmin.preVisits.emptyDesc')}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
            <table className="table table-sm table-zebra">
              <thead>
                <tr>
                  <th>{t('superadmin.preVisits.thAgent')}</th>
                  <th className="hidden sm:table-cell">{t('superadmin.preVisits.thSalesCode')}</th>
                  <th>{t('superadmin.preVisits.thStatus')}</th>
                  <th>{t('superadmin.preVisits.thPreVisits')}</th>
                  <th aria-label={t('superadmin.preVisits.thActions')} />
                </tr>
              </thead>
              <tbody>
                {agentData.map((agent) => (
                  <tr key={agent.email} className="hover:bg-base-200/50">
                    <td>
                      <Link
                        href={`/superadmin/pre-visits/${encodeURIComponent(
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
                        {agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}
                      </span>
                    </td>
                    <td className="font-medium tabular-nums">
                      {agent.previsit_count}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/superadmin/pre-visits/${encodeURIComponent(
                            agent.email
                          )}`}
                          aria-label={t('superadmin.preVisits.viewAria', { name: agent.agent_name })}
                          title={t('superadmin.preVisits.viewTitle')}
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
            basePath="/superadmin/pre-visits"
          />
        </>
      )}
    </div>
  )
}
