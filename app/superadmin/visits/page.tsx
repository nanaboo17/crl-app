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

type VisitFilter = 'all' | 'met' | 'absent' | 'gps' | 'none'
type AgentRow = { email: string; agent_name: string | null; active: boolean | null }
type VisitRow = { agent_email: string | null; visit_status_kunjungan: string | null; location_match: boolean | null; visit_date: string }

export default async function SuperadminVisitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const mode = typeof params.mode === 'string' ? params.mode : ''
  const requestedPage = Math.max(1, Math.floor(Number(params.page) || 1))
  const rawFilter = typeof params.filter === 'string' ? params.filter : 'all'
  const filter: VisitFilter = ['all', 'met', 'absent', 'gps', 'none'].includes(rawFilter) ? rawFilter as VisitFilter : 'all'
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, allMessages, key, values)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const email = user.email.trim().toLowerCase()
  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', email).maybeSingle()
  if (!currentUser || !currentUser.active || currentUser.role !== 'superadmin') redirect('/auth/route')

  const { data: activity, error: activityError } = await supabase.rpc('crl_superadmin_activity_summary_v1', { p_kind: 'visits' })
  if (activityError || !activity || typeof activity !== 'object' || Array.isArray(activity)) {
    const message = activityError?.message ?? 'Visit summary unavailable'
    console.error('superadmin/visits:', message)
    return <div className={styles.page}><SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.visits') }]} title={t('superadmin.visits.title')} description={t('superadmin.visits.description')} /><SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.visits.errorTitle')} description={message} /></div>
  }
  type VisitAgentSummary = AgentRow & { total: number; met: number; absent: number; gps: number }
  const summary = activity as unknown as { agents: VisitAgentSummary[]; totalVisits: number; todayVisits: number; gpsMismatches: number }
  const allAgents = (summary.agents ?? []).filter((agent) => agent.active === true)
  const matches = (agent: VisitAgentSummary) => filter === 'all' ||
    (filter === 'none' && agent.total === 0) ||
    (filter === 'gps' && agent.gps > 0) ||
    (filter === 'met' && agent.met > 0) ||
    (filter === 'absent' && agent.absent > 0)
  const filteredAgents = allAgents.filter(matches)
  const totalAgents = filteredAgents.length
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(totalAgents / PAGE_SIZE)))
  if (totalAgents > 0 && requestedPage !== page) redirect(`/superadmin/visits?mode=agent&filter=${filter}&page=${page}`)
  const agents = filteredAgents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const agentData = agents.map((agent) => ({ ...agent, visit_count: agent.total }))
  const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' })
  const today = dateFormatter.format(new Date())
  const filters: { key: VisitFilter; label: string; count: number }[] = [
    { key: 'all', label: tx('All agents', 'Semua agen'), count: allAgents.length },
    { key: 'met', label: tx('Met customer', 'Bertemu pelanggan'), count: allAgents.filter(a => a.met > 0).length },
    { key: 'absent', label: tx('Customer absent', 'Pelanggan tidak di tempat'), count: allAgents.filter(a => a.absent > 0).length },
    { key: 'gps', label: tx('GPS mismatch', 'GPS tidak sesuai'), count: allAgents.filter(a => a.gps > 0).length },
    { key: 'none', label: tx('No visits', 'Belum ada kunjungan'), count: allAgents.filter(a => a.total === 0).length },
  ]
  const summaries = [
    { label: t('superadmin.visits.totalAgents'), value: allAgents.length, icon: Users, tone: 'purple' },
    { label: t('superadmin.visits.totalVisits'), value: summary.totalVisits, icon: MapPin, tone: 'blue' },
    { label: tx('Visits Today', 'Kunjungan Hari Ini'), value: summary.todayVisits, icon: CalendarDays, tone: 'green' },
    { label: tx('GPS Mismatch', 'GPS Tidak Sesuai'), value: summary.gpsMismatches, icon: Route, tone: 'yellow' },
  ]

  return <div className={styles.page}>
    <SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.visits') }]} title={t('superadmin.visits.title')} description={t('superadmin.visits.description')} />

    {mode !== 'agent' && (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
        <div role="dialog" aria-modal="true" aria-labelledby="visit-view-title" className="w-full max-w-xl rounded-3xl border border-base-300 bg-base-100 p-6 shadow-2xl sm:p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-secondary/15 text-secondary"><CalendarDays className="size-7" /></div>
            <h2 id="visit-view-title" className="text-2xl font-black">{tx('Choose Visit View', 'Pilih Tampilan Kunjungan')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-base-content/60">{tx('Review Visits across a date range, or continue with the existing agent-based monitor.', 'Tinjau Kunjungan dalam rentang tanggal, atau lanjutkan dengan monitoring berbasis agen.')}</p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href={`/superadmin/visits/date?start=${today}&end=${today}`} className="group rounded-2xl border border-base-300 bg-base-100 p-5 transition hover:border-primary hover:bg-primary/5">
              <CalendarDays className="mb-3 size-6 text-primary" />
              <div className="font-black">{tx('View by Date Range', 'Lihat per Rentang Tanggal')}</div>
              <div className="mt-1 text-xs leading-5 text-base-content/60">{tx('Choose WIB start and end dates, see every Supabase Visit field, and generate a filtered CSV report.', 'Pilih tanggal mulai dan akhir WIB, lihat semua field Visit dari Supabase, dan buat laporan CSV terfilter.')}</div>
            </Link>
            <Link href="/superadmin/visits?mode=agent&filter=all&page=1" className="group rounded-2xl border border-base-300 bg-base-100 p-5 transition hover:border-secondary hover:bg-secondary/5">
              <Users className="mb-3 size-6 text-secondary" />
              <div className="font-black">{tx('View by Agent', 'Lihat per Agen')}</div>
              <div className="mt-1 text-xs leading-5 text-base-content/60">{tx('Use the current agent monitor, filters, daily activity, and record details.', 'Gunakan monitoring agen, filter, aktivitas harian, dan detail record.')}</div>
            </Link>
          </div>
        </div>
      </div>
    )}

    <section className={styles.hero}><div><span className={styles.heroKicker}>{tx('FIELD MONITORING', 'MONITORING LAPANGAN')}</span><h2>{tx('Follow every visit journey.', 'Pantau setiap perjalanan kunjungan.')}</h2><p>{tx('Review agent activity, visit volume and location validation from one place.', 'Tinjau aktivitas agen, volume kunjungan, dan validasi lokasi dari satu tempat.')}</p></div><div className={styles.heroScene} aria-hidden="true"><span>📍</span><span>🛵</span><span>🏘️</span></div></section>
    <section className={styles.summaryGrid} aria-label={tx('Visit summary', 'Ringkasan kunjungan')}>{summaries.map(({ label, value, icon: Icon, tone }) => <article key={label} className={`${styles.summaryCard} ${styles[`tone_${tone}`]}`}><div className={styles.summaryIcon}><Icon aria-hidden="true" className="size-5" /></div><div><div className={styles.summaryValue}>{value}</div><div className={styles.summaryLabel}>{label}</div></div></article>)}</section>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav className={styles.filterBar} aria-label={tx('Visit filters', 'Filter kunjungan')}>{filters.map((item) => <Link key={item.key} href={`/superadmin/visits?mode=agent&filter=${item.key}&page=1`} className={`${styles.filterChip} ${filter === item.key ? styles.filterActive : ''}`}>{item.label}<span>{item.count}</span></Link>)}</nav>
      <Link href="/superadmin/visits" className="dui-btn dui-btn-ghost dui-btn-sm">{tx('Change View', 'Ganti Tampilan')}</Link>
    </div>

    {agents.length === 0 ? <SuperadminState icon={Inbox} title={tx('No agents match this filter', 'Tidak ada agen yang sesuai filter')} description={tx('Choose another visit filter to continue.', 'Pilih filter kunjungan lain untuk melanjutkan.')} /> : <>
      <section className={styles.monitorCard}><div className={styles.sectionHeader}><div><h2>{tx('Agent Visit Monitor', 'Monitoring Kunjungan Agen')}</h2><p>{tx('Open an agent to review visit days, checkpoints and details.', 'Buka agen untuk meninjau hari kunjungan, checkpoint, dan detail.')}</p></div></div>
        <div className={styles.tableCard}><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>{t('superadmin.visits.thAgent')}</th><th>{t('superadmin.visits.thStatus')}</th><th>{t('superadmin.visits.thVisits')}</th><th aria-label={t('superadmin.visits.thActions')} /></tr></thead><tbody>{agentData.map((agent, index) => <tr key={agent.email}><td><Link href={`/superadmin/visits/${encodeURIComponent(agent.email)}`} className={styles.agentLink}><span className={`${styles.avatar} ${styles[`avatar_${index % 4}`]}`}>{(agent.agent_name || agent.email).slice(0, 1).toUpperCase()}</span><span><span className={styles.agentName}>{agent.agent_name || '—'}</span><span className={styles.agentEmail}>{agent.email}</span></span></Link></td><td><span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span></td><td><span className={styles.visitPill}>{agent.visit_count}</span></td><td className={styles.actionCell}><Link href={`/superadmin/visits/${encodeURIComponent(agent.email)}`} aria-label={t('superadmin.visits.viewAria', { name: agent.agent_name || agent.email })} title={t('superadmin.visits.viewTitle')} className={styles.iconButton}><Eye aria-hidden="true" className="size-4" /></Link></td></tr>)}</tbody></table></div></div>
        <div className={styles.mobileList}>{agentData.map((agent, index) => <article key={agent.email} className={styles.mobileCard}><div className={styles.mobileTop}><div className={styles.agentLink}><span className={`${styles.avatar} ${styles[`avatar_${index % 4}`]}`}>{(agent.agent_name || agent.email).slice(0, 1).toUpperCase()}</span><span><span className={styles.agentName}>{agent.agent_name || '—'}</span><span className={styles.agentEmail}>{agent.email}</span></span></div><span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span></div><div className={styles.mobileMeta}><div><span>{t('superadmin.visits.thVisits')}</span><strong>{agent.visit_count}</strong></div></div><div className={styles.mobileAction}><Link href={`/superadmin/visits/${encodeURIComponent(agent.email)}`} className={styles.viewButton}><Eye aria-hidden="true" className="size-4" />{t('superadmin.visits.viewTitle')}</Link></div></article>)}</div>
      </section>
      <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={totalAgents} basePath={`/superadmin/visits?mode=agent&filter=${filter}`} />
    </>}
  </div>
}
