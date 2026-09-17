import Link from 'next/link'
import { AlertCircle, Inbox, Pencil, ShieldCheck, UserPlus, UsersRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

const PAGE_SIZE = 10

export default async function ManageAgentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const selectedOrganization = typeof params.organization === 'string' ? params.organization.trim() : ''
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, allMessages, key, values)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = await createClient()

  const { data: organizationRows } = await supabase
    .from('agents')
    .select('organization')
    .not('organization', 'is', null)
    .order('organization')

  const organizations = Array.from(new Set(
    (organizationRows ?? [])
      .map((row) => (row.organization || '').trim())
      .filter(Boolean)
  ))

  let agentsQuery = supabase
    .from('agents')
    .select('email, agent_name, sales_code, role, active, organization', { count: 'exact' })
    .order('agent_name')

  if (selectedOrganization) agentsQuery = agentsQuery.eq('organization', selectedOrganization)

  const { data: agents, error, count } = await agentsQuery
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (error) {
    console.error('superadmin/agents:', error.message)
    return (
      <div className={styles.page}>
        <SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.agents') }]} title={t('superadmin.agents.title')} description={t('superadmin.agents.description')} />
        <SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.agents.errorTitle')} description={t('superadmin.agents.errorDesc')} />
      </div>
    )
  }

  let activeQuery = supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
  if (selectedOrganization) activeQuery = activeQuery.eq('organization', selectedOrganization)
  const { count: activeCount } = await activeQuery

  let fieldAgentQuery = supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .eq('role', 'agent')
  if (selectedOrganization) fieldAgentQuery = fieldAgentQuery.eq('organization', selectedOrganization)
  const { count: fieldAgentCount } = await fieldAgentQuery

  const total = count ?? 0
  const inactiveCount = Math.max(total - (activeCount ?? 0), 0)
  const paginationBasePath = selectedOrganization
    ? `/superadmin/agents?organization=${encodeURIComponent(selectedOrganization)}`
    : '/superadmin/agents'

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.agents') }]}
        title={t('superadmin.agents.title')}
        description={tx('Manage your field team, roles, and account status.', 'Kelola tim lapangan, peran, dan status akun.')}
        actions={<Link href="/superadmin/agents/new" className={styles.addButton}><UserPlus aria-hidden="true" className="size-4" />{tx('Add Agent', 'Tambah Agen')}</Link>}
      />

      <section className={styles.heroCard}>
        <div>
          <span className={styles.heroEyebrow}>{tx('TEAM MANAGEMENT', 'MANAJEMEN TIM')}</span>
          <h2>{tx('Keep every agent ready for the field.', 'Pastikan setiap agen siap turun ke lapangan.')}</h2>
          <p>{tx('Review active accounts, role coverage, and agent details from one place.', 'Tinjau akun aktif, cakupan peran, dan detail agen dari satu tempat.')}</p>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.heroSun} />
          <div className={styles.heroHill} />
          <div className={styles.heroPeople}>👩‍💼 👨‍💼</div>
        </div>
      </section>

      <form method="get" className="flex flex-col gap-2 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-1 text-sm font-semibold">
          <span>{tx('Organization', 'Organisasi')}</span>
          <select name="organization" defaultValue={selectedOrganization} className="dui-select dui-select-bordered w-full">
            <option value="">{tx('All organizations', 'Semua organisasi')}</option>
            {organizations.map((organization) => <option key={organization} value={organization}>{organization}</option>)}
          </select>
        </label>
        <button type="submit" className="dui-btn dui-btn-primary">{tx('Apply filter', 'Terapkan filter')}</button>
        {selectedOrganization ? <Link href="/superadmin/agents" className="dui-btn dui-btn-ghost">{tx('Clear', 'Hapus')}</Link> : null}
      </form>

      <section className={styles.statsGrid} aria-label={tx('Agent summary', 'Ringkasan agen')}>
        <div className={`${styles.summaryCard} ${styles.purpleCard}`}>
          <div className={styles.summaryIcon}><UsersRound aria-hidden="true" /></div>
          <span>{tx('Total Team', 'Total Tim')}</span>
          <strong>{total}</strong>
          <small>{selectedOrganization || tx('all registered users', 'semua pengguna terdaftar')}</small>
        </div>
        <div className={`${styles.summaryCard} ${styles.greenCard}`}>
          <div className={styles.summaryIcon}><ShieldCheck aria-hidden="true" /></div>
          <span>{tx('Active Accounts', 'Akun Aktif')}</span>
          <strong>{activeCount ?? 0}</strong>
          <small>{tx('ready to access CRL', 'siap mengakses CRL')}</small>
        </div>
        <div className={`${styles.summaryCard} ${styles.yellowCard}`}>
          <div className={styles.summaryEmoji}>🧭</div>
          <span>{tx('Field Agents', 'Agen Lapangan')}</span>
          <strong>{fieldAgentCount ?? 0}</strong>
          <small>{tx('active role: agent', 'peran aktif: agen')}</small>
        </div>
        <div className={`${styles.summaryCard} ${styles.blueCard}`}>
          <div className={styles.summaryEmoji}>💤</div>
          <span>{tx('Inactive', 'Tidak Aktif')}</span>
          <strong>{inactiveCount}</strong>
          <small>{tx('accounts currently disabled', 'akun yang sedang dinonaktifkan')}</small>
        </div>
      </section>

      {agents.length === 0 ? (
        <SuperadminState icon={Inbox} title={t('superadmin.agents.emptyTitle')} description={t('superadmin.agents.emptyDesc')} />
      ) : (
        <>
          <section className={styles.rosterCard}>
            <div className={styles.sectionHeading}>
              <div>
                <span>{tx('TEAM ROSTER', 'DAFTAR TIM')}</span>
                <h2>{tx('Agents & access', 'Agen & akses')}</h2>
              </div>
              <div className={styles.rosterCount}>{total} {tx('members', 'anggota')}</div>
            </div>

            <div className={styles.tableCard}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr><th>{t('superadmin.agents.thAgent')}</th><th>{tx('Organization', 'Organisasi')}</th><th>{t('superadmin.agents.thSalesCode')}</th><th>{t('superadmin.agents.thRole')}</th><th>{t('superadmin.agents.thStatus')}</th><th aria-label={t('superadmin.agents.thActions')} /></tr></thead>
                  <tbody>
                    {agents.map((agent, index) => (
                      <tr key={agent.email}>
                        <td>
                          <Link href={`/superadmin/agents/${encodeURIComponent(agent.email)}`} className={styles.agentLink}>
                            <span className={`${styles.avatar} ${styles[`avatar${(index % 4) + 1}`]}`}>{(agent.agent_name || agent.email).trim().slice(0, 2).toUpperCase()}</span>
                            <span className={styles.agentIdentity}><span className={styles.agentName}>{agent.agent_name || '—'}</span><span className={styles.agentEmail}>{agent.email}</span></span>
                          </Link>
                        </td>
                        <td>{agent.organization || '—'}</td>
                        <td className={styles.code}>{agent.sales_code || '—'}</td>
                        <td><span className={styles.roleBadge}>{agent.role}</span></td>
                        <td><span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span></td>
                        <td className={styles.actions}><Link href={`/superadmin/agents/${encodeURIComponent(agent.email)}`} aria-label={t('superadmin.agents.editAria', { name: agent.agent_name || agent.email })} title={t('superadmin.agents.editTitle')} className={styles.editButton}><Pencil aria-hidden="true" className="size-4" /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.mobileList}>
              {agents.map((agent, index) => (
                <article key={agent.email} className={styles.mobileCard}>
                  <div className={styles.mobileTop}>
                    <div className={styles.mobileIdentity}>
                      <span className={`${styles.avatar} ${styles[`avatar${(index % 4) + 1}`]}`}>{(agent.agent_name || agent.email).trim().slice(0, 2).toUpperCase()}</span>
                      <div><div className={styles.agentName}>{agent.agent_name || '—'}</div><div className={styles.agentEmail}>{agent.email}</div></div>
                    </div>
                    <span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span>
                  </div>
                  <div className={styles.mobileMeta}><div><span>{tx('Organization', 'Organisasi')}</span><strong>{agent.organization || '—'}</strong></div><div><span>{t('superadmin.agents.thSalesCode')}</span><strong>{agent.sales_code || '—'}</strong></div><div><span>{t('superadmin.agents.thRole')}</span><strong>{agent.role}</strong></div></div>
                  <div className={styles.mobileAction}><Link href={`/superadmin/agents/${encodeURIComponent(agent.email)}`} className={styles.viewButton}><Pencil aria-hidden="true" className="size-4" />{t('superadmin.agents.editTitle')}</Link></div>
                </article>
              ))}
            </div>
          </section>

          <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={total} basePath={paginationBasePath} />
        </>
      )}
    </div>
  )
}
