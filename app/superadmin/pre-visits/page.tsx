import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, ClipboardCheck, ClipboardList, Eye, Inbox, RefreshCcw, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

const PAGE_SIZE = 10

export default async function AdminPreVisitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const page = Math.max(1, Math.floor(Number(params.page) || 1))
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, allMessages, key, values)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const email = user.email.trim().toLowerCase()
  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', email).maybeSingle()
  if (!currentUser || !currentUser.active || !['admin', 'superadmin'].includes(currentUser.role)) redirect('/auth/route')

  const [{ data: agents, error, count: totalAgents }, totalResult, readyResult, followUpResult] = await Promise.all([
    supabase
      .from('agents')
      .select('email, agent_name, sales_code, active', { count: 'exact' })
      .eq('role', 'agent')
      .order('agent_name')
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }).eq('previsit_status', 'Ready for Visit'),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }).eq('previsit_status', 'Need Follow-up'),
  ])

  if (error) {
    console.error('superadmin/pre-visits:', error.message)
    return (
      <div className={styles.page}>
        <SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.preVisits') }]} title={t('superadmin.preVisits.title')} description={t('superadmin.preVisits.description')} />
        <SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.preVisits.errorTitle')} description={t('superadmin.preVisits.errorDesc')} />
      </div>
    )
  }

  const agentData = await Promise.all((agents ?? []).map(async (agent) => {
    const { count } = await supabase.from('pre_visits').select('*', { count: 'exact', head: true }).eq('agent_email', agent.email)
    return { ...agent, previsit_count: count ?? 0 }
  }))

  const totalPreVisits = totalResult.count ?? 0
  const readyCount = readyResult.count ?? 0
  const followUpCount = followUpResult.count ?? 0

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.preVisits') }]}
        title={t('superadmin.preVisits.title')}
        description={t('superadmin.preVisits.description')}
      />

      <section className={styles.hero}>
        <div>
          <p className={styles.heroEyebrow}>{tx('PRE-VISIT CONTROL', 'KONTROL PRA-KUNJUNGAN')}</p>
          <h2>{tx('Keep every field visit prepared and on track.', 'Pastikan setiap kunjungan lapangan siap dan terarah.')}</h2>
          <p>{tx('Review agent preparation, follow-up demand, and readiness before the team reaches the customer.', 'Pantau persiapan agen, kebutuhan tindak lanjut, dan kesiapan sebelum tim menemui pelanggan.')}</p>
        </div>
        <div className={styles.heroScene} aria-hidden="true">
          <div className={styles.heroChecklist}>✓</div>
          <div className={styles.heroPath} />
          <div className={styles.heroPin}>📍</div>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label={tx('Pre-visit summary', 'Ringkasan pra-kunjungan')}>
        <div className={`${styles.summaryCard} ${styles.purple}`}><div><span>{t('superadmin.preVisits.totalAgents')}</span><strong>{totalAgents ?? 0}</strong></div><div className={styles.summaryIcon}><Users /></div></div>
        <div className={`${styles.summaryCard} ${styles.yellow}`}><div><span>{t('superadmin.preVisits.totalPreVisits')}</span><strong>{totalPreVisits}</strong></div><div className={styles.summaryIcon}><ClipboardList /></div></div>
        <div className={`${styles.summaryCard} ${styles.green}`}><div><span>{tx('Ready for Visit', 'Siap Dikunjungi')}</span><strong>{readyCount}</strong></div><div className={styles.summaryIcon}><ClipboardCheck /></div></div>
        <div className={`${styles.summaryCard} ${styles.orange}`}><div><span>{tx('Need Follow-up', 'Perlu Tindak Lanjut')}</span><strong>{followUpCount}</strong></div><div className={styles.summaryIcon}><RefreshCcw /></div></div>
      </section>

      {agents?.length === 0 ? (
        <SuperadminState icon={Inbox} title={t('superadmin.preVisits.emptyTitle')} description={t('superadmin.preVisits.emptyDesc')} />
      ) : (
        <section className={styles.rosterCard}>
          <div className={styles.sectionHeader}>
            <div>
              <span>{tx('MONITOR BY AGENT', 'PANTAU PER AGEN')}</span>
              <h2>{tx('Pre-Visit Activity', 'Aktivitas Pra-Kunjungan')}</h2>
              <p>{tx('Open an agent to review activity by day and individual pre-visit record.', 'Buka agen untuk melihat aktivitas per hari dan detail setiap pra-kunjungan.')}</p>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>{t('superadmin.preVisits.thAgent')}</th><th>{t('superadmin.preVisits.thSalesCode')}</th><th>{t('superadmin.preVisits.thStatus')}</th><th>{t('superadmin.preVisits.thPreVisits')}</th><th aria-label={t('superadmin.preVisits.thActions')} /></tr></thead>
                <tbody>{agentData.map((agent, index) => <tr key={agent.email}><td><Link href={`/superadmin/pre-visits/${encodeURIComponent(agent.email)}`} className={styles.agentLink}><span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(agent.agent_name || agent.email).slice(0, 2).toUpperCase()}</span><span><strong className={styles.agentName}>{agent.agent_name || '—'}</strong><small className={styles.agentEmail}>{agent.email}</small></span></Link></td><td>{agent.sales_code || '—'}</td><td><span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span></td><td><span className={styles.countPill}>{agent.previsit_count}</span></td><td className={styles.actionCell}><Link href={`/superadmin/pre-visits/${encodeURIComponent(agent.email)}`} aria-label={t('superadmin.preVisits.viewAria', { name: agent.agent_name })} title={t('superadmin.preVisits.viewTitle')} className={styles.iconButton}><Eye aria-hidden="true" className="size-4" /></Link></td></tr>)}</tbody>
              </table>
            </div>
          </div>

          <div className={styles.mobileList}>
            {agentData.map((agent, index) => (
              <article key={agent.email} className={styles.mobileCard}>
                <div className={styles.mobileTop}><div className={styles.mobileIdentity}><span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(agent.agent_name || agent.email).slice(0, 2).toUpperCase()}</span><div><div className={styles.agentName}>{agent.agent_name || '—'}</div><div className={styles.agentEmail}>{agent.email}</div></div></div><span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span></div>
                <div className={styles.mobileMeta}><div><span>{t('superadmin.preVisits.thSalesCode')}</span><strong>{agent.sales_code || '—'}</strong></div><div><span>{t('superadmin.preVisits.thPreVisits')}</span><strong>{agent.previsit_count}</strong></div></div>
                <div className={styles.mobileAction}><Link href={`/superadmin/pre-visits/${encodeURIComponent(agent.email)}`} className={styles.viewButton}><Eye aria-hidden="true" className="size-4" />{t('superadmin.preVisits.viewTitle')}</Link></div>
              </article>
            ))}
          </div>

          <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={totalAgents ?? 0} basePath="/superadmin/pre-visits" />
        </section>
      )}
    </div>
  )
}
