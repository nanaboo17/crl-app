import Link from 'next/link'
import { AlertCircle, Inbox, Pencil, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

const PAGE_SIZE = 10

export default async function ManageAgentsPage({
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
            { label: t('superadmin.bc.superadmin'), href: '/superadmin' },
            { label: t('superadmin.bc.agents') },
          ]}
          title={t('superadmin.agents.title')}
          description={t('superadmin.agents.description')}
        />
        <SuperadminState
          tone="error"
          icon={AlertCircle}
          title={t('superadmin.agents.errorTitle')}
          description={t('superadmin.agents.errorDesc')}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: t('superadmin.bc.superadmin'), href: '/superadmin' },
          { label: t('superadmin.bc.agents') },
        ]}
        title={t('superadmin.agents.title')}
        description={t('superadmin.agents.description')}
        actions={
          <Link href="/superadmin/agents/new" className={styles.addButton}>
            <UserPlus aria-hidden="true" className="size-4" />
            Add Agent
          </Link>
        }
      />

      {agents.length === 0 ? (
        <SuperadminState
          icon={Inbox}
          title={t('superadmin.agents.emptyTitle')}
          description={t('superadmin.agents.emptyDesc')}
        />
      ) : (
        <>
          <div className={styles.tableCard}>
            <div className={styles.mobileHint}>Swipe horizontally to see all columns.</div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('superadmin.agents.thAgent')}</th>
                    <th className={styles.salesCode}>{t('superadmin.agents.thSalesCode')}</th>
                    <th>{t('superadmin.agents.thRole')}</th>
                    <th>{t('superadmin.agents.thStatus')}</th>
                    <th aria-label={t('superadmin.agents.thActions')} />
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.email}>
                      <td>
                        <Link
                          href={`/superadmin/agents/${encodeURIComponent(agent.email)}`}
                          className={styles.agentLink}
                        >
                          <span className={styles.agentName}>
                            {agent.agent_name || '—'}
                          </span>
                          <span className={styles.agentEmail}>{agent.email}</span>
                        </Link>
                      </td>
                      <td className={`${styles.salesCode} ${styles.code}`}>
                        {agent.sales_code || '—'}
                      </td>
                      <td>
                        <span className={styles.badge}>{agent.role}</span>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            agent.active ? styles.active : styles.inactive
                          }`}
                        >
                          {agent.active
                            ? t('superadmin.status.active')
                            : t('superadmin.status.inactive')}
                        </span>
                      </td>
                      <td className={styles.actions}>
                        <Link
                          href={`/superadmin/agents/${encodeURIComponent(agent.email)}`}
                          aria-label={t('superadmin.agents.editAria', {
                            name: agent.agent_name || agent.email,
                          })}
                          title={t('superadmin.agents.editTitle')}
                          className={styles.editButton}
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
