import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, ClipboardCheck, ClipboardList, Eye, Inbox, RefreshCcw, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { cacheGetOrSet } from '@/lib/redis-cache'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

const PAGE_SIZE = 10
const CACHE_TTL = 60

type PreVisitFilter = 'all' | 'ready' | 'followup' | 'direct' | 'rescheduled' | 'stopped' | 'none'
type AgentRow = { email: string; agent_name: string | null; sales_code: string | null; active: boolean | null }
type PreVisitRow = { agent_email: string | null; previsit_status: string | null; created_at: string }
type PreVisitCache = { agents: AgentRow[]; preVisits: PreVisitRow[]; totalPreVisits: number }

export default async function AdminPreVisitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const requestedPage = Math.max(1, Math.floor(Number(params.page) || 1))
  const rawFilter = typeof params.filter === 'string' ? params.filter : 'all'
  const filter: PreVisitFilter = ['all', 'ready', 'followup', 'direct', 'rescheduled', 'stopped', 'none'].includes(rawFilter) ? rawFilter as PreVisitFilter : 'all'
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, allMessages, key, values)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const email = user.email.trim().toLowerCase()
  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', email).maybeSingle()
  if (!currentUser || !currentUser.active || !['admin', 'superadmin'].includes(currentUser.role)) redirect('/auth/route')

  let payload: PreVisitCache
  try {
    payload = await cacheGetOrSet<PreVisitCache>('crl:superadmin:previsits:v1', CACHE_TTL, async () => {
      const [agentsResult, preVisitsResult, totalResult] = await Promise.all([
        supabase.from('agents').select('email, agent_name, sales_code, active').eq('role', 'agent').order('agent_name'),
        supabase.from('pre_visits').select('agent_email, previsit_status, created_at'),
        supabase.from('pre_visits').select('*', { count: 'exact', head: true }),
      ])
      const error = agentsResult.error || preVisitsResult.error || totalResult.error
      if (error) throw error
      return {
        agents: (agentsResult.data ?? []) as AgentRow[],
        preVisits: (preVisitsResult.data ?? []) as PreVisitRow[],
        totalPreVisits: totalResult.count ?? 0,
      }
    })
  } catch (error) {
    console.error('superadmin/pre-visits:', error)
    return <div className={styles.page}><SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.preVisits') }]} title={t('superadmin.preVisits.title')} description={t('superadmin.preVisits.description')} /><SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.preVisits.errorTitle')} description={t('superadmin.preVisits.errorDesc')} /></div>
  }

  const allAgents = payload.agents
  const preVisits = payload.preVisits
  const preVisitMap = new Map<string, PreVisitRow[]>()
  for (const row of preVisits) {
    const key = (row.agent_email || '').toLowerCase()
    if (!key) continue
    preVisitMap.set(key, [...(preVisitMap.get(key) ?? []), row])
  }

  const statusFor = (key: Exclude<PreVisitFilter, 'all' | 'none'>) => ({
    ready: 'Ready for Visit',
    followup: 'Need Follow-up',
    direct: 'Direct Visit',
    rescheduled: 'Rescheduled',
    stopped: 'Stopped',
  }[key])

  const matches = (agentEmail: string) => {
    const rows = preVisitMap.get(agentEmail.toLowerCase()) ?? []
    if (filter === 'all') return true
    if (filter === 'none') return rows.length === 0
    return rows.some((row) => row.previsit_status === statusFor(filter))
  }

  const filteredAgents = allAgents.filter((agent) => matches(agent.email))
  const totalAgents = filteredAgents.length
  const totalPages = Math.max(1, Math.ceil(totalAgents / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  if (totalAgents > 0 && requestedPage !== page) redirect(`/superadmin/pre-visits?filter=${filter}&page=${page}`)
  const agents = filteredAgents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const agentData = agents.map((agent) => ({ ...agent, previsit_count: (preVisitMap.get(agent.email.toLowerCase()) ?? []).length }))

  const countStatus = (status: string) => preVisits.filter((row) => row.previsit_status === status).length
  const readyCount = countStatus('Ready for Visit')
  const followUpCount = countStatus('Need Follow-up')
  const filters: { key: PreVisitFilter; label: string; count: number }[] = [
    { key: 'all', label: tx('All agents', 'Semua agen'), count: allAgents.length },
    { key: 'ready', label: tx('Ready', 'Siap dikunjungi'), count: allAgents.filter((a) => (preVisitMap.get(a.email.toLowerCase()) ?? []).some((r) => r.previsit_status === 'Ready for Visit')).length },
    { key: 'followup', label: tx('Follow-up', 'Tindak lanjut'), count: allAgents.filter((a) => (preVisitMap.get(a.email.toLowerCase()) ?? []).some((r) => r.previsit_status === 'Need Follow-up')).length },
    { key: 'direct', label: tx('Direct Visit', 'Kunjungan langsung'), count: allAgents.filter((a) => (preVisitMap.get(a.email.toLowerCase()) ?? []).some((r) => r.previsit_status === 'Direct Visit')).length },
    { key: 'rescheduled', label: tx('Rescheduled', 'Dijadwalkan ulang'), count: allAgents.filter((a) => (preVisitMap.get(a.email.toLowerCase()) ?? []).some((r) => r.previsit_status === 'Rescheduled')).length },
    { key: 'stopped', label: tx('Stopped', 'Dihentikan'), count: allAgents.filter((a) => (preVisitMap.get(a.email.toLowerCase()) ?? []).some((r) => r.previsit_status === 'Stopped')).length },
    { key: 'none', label: tx('No pre-visit', 'Belum ada pra-kunjungan'), count: allAgents.filter((a) => (preVisitMap.get(a.email.toLowerCase()) ?? []).length === 0).length },
  ]

  return (
    <div className={styles.page}>
      <SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.preVisits') }]} title={t('superadmin.preVisits.title')} description={t('superadmin.preVisits.description')} />
      <section className={styles.hero}><div><p className={styles.heroEyebrow}>{tx('PRE-VISIT CONTROL', 'KONTROL PRA-KUNJUNGAN')}</p><h2>{tx('Keep every field visit prepared and on track.', 'Pastikan setiap kunjungan lapangan siap dan terarah.')}</h2><p>{tx('Review agent preparation, follow-up demand, and readiness before the team reaches the customer.', 'Pantau persiapan agen, kebutuhan tindak lanjut, dan kesiapan sebelum tim menemui pelanggan.')}</p></div><div className={styles.heroScene} aria-hidden="true"><div className={styles.heroChecklist}>✓</div><div className={styles.heroPath} /><div className={styles.heroPin}>📍</div></div></section>
      <section className={styles.summaryGrid} aria-label={tx('Pre-visit summary', 'Ringkasan pra-kunjungan')}><div className={`${styles.summaryCard} ${styles.purple}`}><div><span>{t('superadmin.preVisits.totalAgents')}</span><strong>{allAgents.length}</strong></div><div className={styles.summaryIcon}><Users /></div></div><div className={`${styles.summaryCard} ${styles.yellow}`}><div><span>{t('superadmin.preVisits.totalPreVisits')}</span><strong>{payload.totalPreVisits}</strong></div><div className={styles.summaryIcon}><ClipboardList /></div></div><div className={`${styles.summaryCard} ${styles.green}`}><div><span>{tx('Ready for Visit', 'Siap Dikunjungi')}</span><strong>{readyCount}</strong></div><div className={styles.summaryIcon}><ClipboardCheck /></div></div><div className={`${styles.summaryCard} ${styles.orange}`}><div><span>{tx('Need Follow-up', 'Perlu Tindak Lanjut')}</span><strong>{followUpCount}</strong></div><div className={styles.summaryIcon}><RefreshCcw /></div></div></section>
      <nav className={styles.filterBar} aria-label={tx('Pre-visit filters', 'Filter pra-kunjungan')}>{filters.map((item) => <Link key={item.key} href={`/superadmin/pre-visits?filter=${item.key}&page=1`} className={`${styles.filterChip} ${filter === item.key ? styles.filterActive : ''}`}>{item.label}<span>{item.count}</span></Link>)}</nav>

      {agents.length === 0 ? <SuperadminState icon={Inbox} title={tx('No agents match this filter', 'Tidak ada agen yang sesuai filter')} description={tx('Choose another pre-visit filter to continue.', 'Pilih filter pra-kunjungan lain untuk melanjutkan.')} /> : <section className={styles.rosterCard}><div className={styles.sectionHeader}><div><span>{tx('MONITOR BY AGENT', 'PANTAU PER AGEN')}</span><h2>{tx('Pre-Visit Activity', 'Aktivitas Pra-Kunjungan')}</h2><p>{tx('Open an agent to review activity by day and individual pre-visit record.', 'Buka agen untuk melihat aktivitas per hari dan detail setiap pra-kunjungan.')}</p></div></div>
        <div className={styles.tableCard}><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>{t('superadmin.preVisits.thAgent')}</th><th>{t('superadmin.preVisits.thSalesCode')}</th><th>{t('superadmin.preVisits.thStatus')}</th><th>{t('superadmin.preVisits.thPreVisits')}</th><th aria-label={t('superadmin.preVisits.thActions')} /></tr></thead><tbody>{agentData.map((agent, index) => <tr key={agent.email}><td><Link href={`/superadmin/pre-visits/${encodeURIComponent(agent.email)}`} className={styles.agentLink}><span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(agent.agent_name || agent.email).slice(0, 2).toUpperCase()}</span><span><strong className={styles.agentName}>{agent.agent_name || '—'}</strong><small className={styles.agentEmail}>{agent.email}</small></span></Link></td><td>{agent.sales_code || '—'}</td><td><span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span></td><td><span className={styles.countPill}>{agent.previsit_count}</span></td><td className={styles.actionCell}><Link href={`/superadmin/pre-visits/${encodeURIComponent(agent.email)}`} aria-label={t('superadmin.preVisits.viewAria', { name: agent.agent_name || agent.email })} title={t('superadmin.preVisits.viewTitle')} className={styles.iconButton}><Eye aria-hidden="true" className="size-4" /></Link></td></tr>)}</tbody></table></div></div>
        <div className={styles.mobileList}>{agentData.map((agent, index) => <article key={agent.email} className={styles.mobileCard}><div className={styles.mobileTop}><div className={styles.mobileIdentity}><span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(agent.agent_name || agent.email).slice(0, 2).toUpperCase()}</span><div><div className={styles.agentName}>{agent.agent_name || '—'}</div><div className={styles.agentEmail}>{agent.email}</div></div></div><span className={`${styles.badge} ${agent.active ? styles.active : styles.inactive}`}>{agent.active ? t('superadmin.status.active') : t('superadmin.status.inactive')}</span></div><div className={styles.mobileMeta}><div><span>{t('superadmin.preVisits.thSalesCode')}</span><strong>{agent.sales_code || '—'}</strong></div><div><span>{t('superadmin.preVisits.thPreVisits')}</span><strong>{agent.previsit_count}</strong></div></div><div className={styles.mobileAction}><Link href={`/superadmin/pre-visits/${encodeURIComponent(agent.email)}`} className={styles.viewButton}><Eye aria-hidden="true" className="size-4" />{t('superadmin.preVisits.viewTitle')}</Link></div></article>)}</div>
        <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={totalAgents} basePath={`/superadmin/pre-visits?filter=${filter}`} />
      </section>}
    </div>
  )
}
