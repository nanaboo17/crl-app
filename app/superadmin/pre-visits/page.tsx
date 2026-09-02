import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertCircle,
  ClipboardList,
  Eye,
  Inbox,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

const PAGE_SIZE = 10

export default async function AdminPreVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) =>
    translate(locale, allMessages, key, values)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const email = user.email.trim().toLowerCase()
  const { data: currentUser } = await supabase
    .from('agents')
    .select('role, active')
    .eq('email', email)
    .maybeSingle()

  if (!currentUser || !currentUser.active || !['admin', 'superadmin'].includes(currentUser.role)) {
    redirect('/auth/route')
  }

  const { data: agents, error, count: totalAgents } = await supabase
    .from('agents')
    .select('email, agent_name, sales_code, active', { count: 'exact' })
    .eq('role', 'agent')
    .order('agent_name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (error) {
    console.error('superadmin/pre-visits:', error.message)
    return (
      <div className={styles.page}>
        <SuperadminPageHeader
          breadcrumbs={[
            { label: t('superadmin.bc.superadmin'), href: '/superadmin' },
            { label: t('superadmin.bc.preVisits') },
          ]}
          title={t('superadmin.preVisits.title')}
          description={t('superadmin.preVisits.description')}
        />
        <SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.preVisits.errorTitle')} description={t('superadmin.preVisits.errorDesc')} />
      </div>
    )
  }

  const [agentData, totalPreVisitsResult] = await Promise.all([
    Promise.all(
      (agents ?? []).map(async (agent) => {
        const { count } = await supabase
          .from('pre_visits')
          .select('*', { count: 'exact', head: true })
          .eq('agent_email', agent.email)
        return { ...agent, previsit_count: count ?? 0 }
      })
    ),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: t('superadmin.bc.superadmin'), href: '/superadmin' },
          { label: t('superadmin.bc.preVisits') },
        ]}
        title={t('superadmin.preVisits.title')}
        description={t('superadmin.preVisits.description')}
      />

      <section className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div>
            <div className={styles.summaryLabel}>{t('superadmin.preVisits.totalAgents')}</div>
            <div className={styles.summaryValue}>{totalAgents ?? 0}</div>
          </div>
          <div className={styles.summaryIcon}><Users aria-hidden="true" className="size-5" /></div>
        </div>
        <div className={styles.summaryCard}>
          <div>
            <div className={styles.summaryLabel}>{t('superadmin.preVisits.totalPreVisits')}</div>
            <div className={styles.summaryValue}>{totalPreVisitsResult.count ?? 0}</div>
          </div>
          <div className={styles.summaryIcon}><ClipboardList aria-hidden="true" className="size-5" /></div>
        </div>
      </section>

      {agents.length === 0 ? (
        <SuperadminState icon={Inbox} title={t('superadmin.preVisits.emptyTitle')} description={t('superadmin.preVisits.emptyDesc')} />
      ) : (
        <>
          <div className={styles.tableCard}>
            <div className={styles.mobileHint}>Swipe horizontally to see all columns.</div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('superadmin.preVisits.thAgent')}</th>
                    <th>{t('superadmin.preVisits.thSalesCode')}</th>
                    <th>{t('superadmin.preVisits.thStatus')}</th>
                    <th>{t('superadmin.preVisits.thPreVisits')}</th>
                    <th aria-label={t('superadmin.preVisits.thActions')} />
                  </tr>
                </thead>
                <tbody>
                  {agentData.map((agent) => (
                    <tr key={agent.email}>
                      <td>
                        <Link href={`/superadmin/pre-visits/${encodeURIComponent(agent.email)}`} className={styles.agentLink}>
                          <span className={styles.agentName}>{agent.agent_name || '—'}</span>
                          <span className={styles.agentEmail}>{agent.email}</span>
                        </Link>
                      </td>
                      <td>{agent.sales_code || '—'}</td>
                      <td><span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span></td>
                      <td className={styles.count}>{agent.previsit_count}</td>
                      <td className={styles.actionCell}>
                        <Link
                          href={`/superadmin/pre-visits/${encodeURIComponent(agent.email)}`}
                          aria-label={t('superadmin.preVisits.viewAria', { name: agent.agent_name })}
                          title={t('superadmin.preVisits.viewTitle')}
                          className={styles.iconButton}
                        >
                          <Eye aria-hidden="true" className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={totalAgents ?? 0} basePath="/superadmin/pre-visits" />
        </>
      )}
    </div>
  )
}
