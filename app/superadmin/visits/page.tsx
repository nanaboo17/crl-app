import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, CalendarDays, Eye, Inbox, MapPin, Route, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

const PAGE_SIZE = 10

export default async function SuperadminVisitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, allMessages, key, values)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const email = user.email.trim().toLowerCase()
  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', email).maybeSingle()
  if (!currentUser || !currentUser.active || currentUser.role !== 'superadmin') redirect('/auth/route')

  const { data: agents, error, count: totalAgents } = await supabase
    .from('agents')
    .select('email, agent_name, sales_code, active', { count: 'exact' })
    .eq('role', 'agent')
    .order('agent_name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (error) {
    console.error('superadmin/visits:', error.message)
    return <div className={styles.page}><SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.visits') }]} title={t('superadmin.visits.title')} description={t('superadmin.visits.description')} /><SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.visits.errorTitle')} description={t('superadmin.visits.errorDesc')} /></div>
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()

  const [agentData, totalVisitsResult, todayVisitsResult, mismatchResult] = await Promise.all([
    Promise.all((agents ?? []).map(async (agent) => {
      const { count } = await supabase.from('visits').select('*', { count: 'exact', head: true }).eq('agent_email', agent.email)
      return { ...agent, visit_count: count ?? 0 }
    })),
    supabase.from('visits').select('*', { count: 'exact', head: true }),
    supabase.from('visits').select('*', { count: 'exact', head: true }).gte('visit_date', todayIso),
    supabase.from('visits').select('*', { count: 'exact', head: true }).eq('location_match', false),
  ])

  const summaries = [
    { label: t('superadmin.visits.totalAgents'), value: totalAgents ?? 0, icon: Users, tone: 'purple' },
    { label: t('superadmin.visits.totalVisits'), value: totalVisitsResult.count ?? 0, icon: MapPin, tone: 'blue' },
    { label: tx('Visits Today', 'Kunjungan Hari Ini'), value: todayVisitsResult.count ?? 0, icon: CalendarDays, tone: 'green' },
    { label: tx('GPS Mismatch', 'GPS Tidak Sesuai'), value: mismatchResult.count ?? 0, icon: Route, tone: 'yellow' },
  ]

  return (
    <div className={styles.page}>
      <SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.visits') }]} title={t('superadmin.visits.title')} description={t('superadmin.visits.description')} />

      <section className={styles.hero}>
        <div>
          <span className={styles.heroKicker}>{tx('FIELD MONITORING', 'MONITORING LAPANGAN')}</span>
          <h2>{tx('Follow every visit journey.', 'Pantau setiap perjalanan kunjungan.')}</h2>
          <p>{tx('Review agent activity, visit volume and location validation from one place.', 'Tinjau aktivitas agen, volume kunjungan, dan validasi lokasi dari satu tempat.')}</p>
        </div>
        <div className={styles.heroScene} aria-hidden="true"><span>📍</span><span>🛵</span><span>🏘️</span></div>
      </section>

      <section className={styles.summaryGrid} aria-label={tx('Visit summary', 'Ringkasan kunjungan')}>
        {summaries.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className={`${styles.summaryCard} ${styles[`tone_${tone}`]}`}>
            <div className={styles.summaryIcon}><Icon aria-hidden="true" className="size-5" /></div>
            <div><div className={styles.summaryValue}>{value}</div><div className={styles.summaryLabel}>{label}</div></div>
          </article>
        ))}
      </section>

      {agents.length === 0 ? (
        <SuperadminState icon={Inbox} title={t('superadmin.visits.emptyTitle')} description={t('superadmin.visits.emptyDesc')} />
      ) : (
        <>
          <section className={styles.monitorCard}>
            <div className={styles.sectionHeader}><div><h2>{tx('Agent Visit Monitor', 'Monitoring Kunjungan Agen')}</h2><p>{tx('Open an agent to review visit days, checkpoints and details.', 'Buka agen untuk meninjau hari kunjungan, checkpoint, dan detail.')}</p></div></div>
            <div className={styles.tableCard}><div className={styles.tableScroll}><table className={styles.table}>
              <thead><tr><th>{t('superadmin.visits.thAgent')}</th><th>{t('superadmin.visits.thSalesCode')}</th><th>{t('superadmin.visits.thStatus')}</th><th>{t('superadmin.visits.thVisits')}</th><th aria-label={t('superadmin.visits.thActions')} /></tr></thead>
              <tbody>{agentData.map((agent, index) => <tr key={agent.email}><td><Link href={`/superadmin/visits/${encodeURIComponent(agent.email)}`} className={styles.agentLink}><span className={`${styles.avatar} ${styles[`avatar_${index % 4}`]}`}>{(agent.agent_name || agent.email).slice(0, 1).toUpperCase()}</span><span><span className={styles.agentName}>{agent.agent_name || '—'}</span><span className={styles.agentEmail}>{agent.email}</span></span></Link></td><td>{agent.sales_code || '—'}</td><td><span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span></td><td><span className={styles.visitPill}>{agent.visit_count}</span></td><td className={styles.actionCell}><Link href={`/superadmin/visits/${encodeURIComponent(agent.email)}`} aria-label={t('superadmin.visits.viewAria', { name: agent.agent_name })} title={t('superadmin.visits.viewTitle')} className={styles.iconButton}><Eye aria-hidden="true" className="size-4" /></Link></td></tr>)}</tbody>
            </table></div></div>

            <div className={styles.mobileList}>{agentData.map((agent, index) => <article key={agent.email} className={styles.mobileCard}><div className={styles.mobileTop}><div className={styles.agentLink}><span className={`${styles.avatar} ${styles[`avatar_${index % 4}`]}`}>{(agent.agent_name || agent.email).slice(0, 1).toUpperCase()}</span><span><span className={styles.agentName}>{agent.agent_name || '—'}</span><span className={styles.agentEmail}>{agent.email}</span></span></div><span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span></div><div className={styles.mobileMeta}><div><span>{t('superadmin.visits.thSalesCode')}</span><strong>{agent.sales_code || '—'}</strong></div><div><span>{t('superadmin.visits.thVisits')}</span><strong>{agent.visit_count}</strong></div></div><div className={styles.mobileAction}><Link href={`/superadmin/visits/${encodeURIComponent(agent.email)}`} className={styles.viewButton}><Eye aria-hidden="true" className="size-4" />{t('superadmin.visits.viewTitle')}</Link></div></article>)}</div>
          </section>
          <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={totalAgents ?? 0} basePath="/superadmin/visits" />
        </>
      )}
    </div>
  )
}
