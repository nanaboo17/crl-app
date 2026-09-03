import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Bell,
  Building2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

import { createClient } from '../../lib/supabase-server'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'
import mode from './dashboard-mode.module.css'

function startOfTodayWib() {
  const now = new Date()
  const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
  return `${wib.getFullYear()}-${String(wib.getMonth() + 1).padStart(2, '0')}-${String(wib.getDate()).padStart(2, '0')}T00:00:00+07:00`
}

function formatTimeAgo(value: string, locale: 'en' | 'id') {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return locale === 'id' ? 'baru saja' : 'just now'
  if (minutes < 60) return locale === 'id' ? `${minutes} menit lalu` : `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return locale === 'id' ? `${hours} jam lalu` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  return locale === 'id' ? `${days} hari lalu` : `${days}d ago`
}

export default async function SuperadminPage() {
  const supabase = await createClient()
  const locale = await getLocale()
  const isId = locale === 'id'
  const tl = (key: string, params?: Record<string, string | number>) => translate(locale, allMessages, key, params)
  const tx = (en: string, id: string) => (isId ? id : en)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { data: agent } = await supabase
    .from('agents')
    .select('agent_name, email, role, active')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()

  if (!agent || !agent.active || agent.role !== 'superadmin') redirect('/auth/route')

  const todayStart = startOfTodayWib()
  const [
    agentsResult,
    customersResult,
    preVisitsResult,
    visitsResult,
    activeAgentsResult,
    todayVisitsResult,
    todayPreVisitsResult,
    attendanceResult,
    recentVisitsResult,
    recentPreVisitsResult,
  ] = await Promise.all([
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }),
    supabase.from('visits').select('*', { count: 'exact', head: true }),
    supabase.from('agents').select('email,agent_name').eq('active', true).eq('role', 'agent').order('agent_name').limit(5),
    supabase.from('visits').select('agent_email,visit_date,location_match').gte('visit_date', todayStart),
    supabase.from('pre_visits').select('agent_email,contact_attempt_date,previsit_status').gte('contact_attempt_date', todayStart),
    supabase.from('agent_attendance').select('agent_email,check_in_status').eq('attendance_date', todayStart.slice(0, 10)),
    supabase.from('visits').select('visit_id,agent_email,customer_id,visit_date').order('visit_date', { ascending: false }).limit(4),
    supabase.from('pre_visits').select('previsit_id,agent_email,customer_id,contact_attempt_date,previsit_status').order('contact_attempt_date', { ascending: false }).limit(4),
  ])

  const todayVisits = todayVisitsResult.data ?? []
  const todayPreVisits = todayPreVisitsResult.data ?? []
  const attendance = attendanceResult.data ?? []
  const activeAgents = activeAgentsResult.data ?? []

  const visitsByAgent = new Map<string, number>()
  for (const visit of todayVisits) {
    visitsByAgent.set(visit.agent_email, (visitsByAgent.get(visit.agent_email) ?? 0) + 1)
  }

  const maxVisits = Math.max(1, ...activeAgents.map((item) => visitsByAgent.get(item.email) ?? 0))
  const agentActivity = activeAgents.map((item) => {
    const visits = visitsByAgent.get(item.email) ?? 0
    const progress = Math.max(8, Math.round((visits / maxVisits) * 100))
    const status = visits >= Math.max(3, maxVisits * 0.6)
      ? tx('On Track', 'Sesuai Target')
      : visits > 0
        ? tx('Need Attention', 'Perlu Perhatian')
        : tx('Behind', 'Tertinggal')
    return { ...item, visits, progress, status }
  })

  const pendingReview = todayPreVisits.filter((item) => item.previsit_status === 'Supervisor Review').length
  const lateAttendance = attendance.filter((item) => item.check_in_status === 'late').length
  const attendanceMissing = Math.max(0, activeAgents.length - attendance.length)
  const checkedInAgents = new Set(attendance.map((item) => item.agent_email)).size
  const gpsMismatchToday = todayVisits.filter((item) => item.location_match === false).length

  const stats = [
    { href: '/superadmin/agents', label: tl('superadmin.dashboard.statAgents'), count: agentsResult.count ?? 0, icon: Users, tone: 'purple' },
    { href: '/superadmin/customers', label: tl('superadmin.dashboard.statCustomers'), count: customersResult.count ?? 0, icon: Building2, tone: 'green' },
    { href: '/superadmin/pre-visits', label: tl('superadmin.dashboard.statPreVisits'), count: preVisitsResult.count ?? 0, icon: ClipboardList, tone: 'yellow' },
    { href: '/superadmin/visits', label: tl('superadmin.dashboard.statVisits'), count: visitsResult.count ?? 0, icon: MapPin, tone: 'blue' },
  ]

  const quickAccess = [
    { href: '/superadmin/agents', title: tx('Manage Agents', 'Kelola Agen'), icon: Users, tone: 'purple' },
    { href: '/superadmin/customers', title: tx('Customer List', 'Daftar Pelanggan'), icon: Building2, tone: 'green' },
    { href: '/superadmin/pre-visits', title: tx('Pre-Visit Monitor', 'Monitor Pra-Kunjungan'), icon: ClipboardList, tone: 'yellow' },
    { href: '/superadmin/visits', title: tx('Visit Monitor', 'Monitor Kunjungan'), icon: MapPin, tone: 'blue' },
    { href: '/superadmin/territories', title: tx('Territories', 'Teritori'), icon: Sparkles, tone: 'pink' },
  ]

  const recentItems = [
    ...(recentVisitsResult.data ?? []).map((item) => ({
      type: 'visit' as const,
      at: item.visit_date,
      title: tx(`Visit completed by ${item.agent_email}`, `Kunjungan diselesaikan oleh ${item.agent_email}`),
      subtitle: item.customer_id,
    })),
    ...(recentPreVisitsResult.data ?? []).map((item) => ({
      type: 'previsit' as const,
      at: item.contact_attempt_date,
      title: tx(`Pre-visit updated by ${item.agent_email}`, `Pra-kunjungan diperbarui oleh ${item.agent_email}`),
      subtitle: `${item.customer_id} · ${item.previsit_status || '-'}`,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 4)

  const totalTodayActions = todayVisits.length + todayPreVisits.length
  const targetToday = Math.max(1, activeAgents.length * 8)
  const progressPct = Math.min(100, Math.round((totalTodayActions / targetToday) * 100))
  const firstName = agent.agent_name?.trim().split(/\s+/)[0] ?? 'Superadmin'

  return (
    <div className={`${styles.page} ${mode.themeRoot}`}>
      <section className={`${styles.hero} ${mode.themeCard}`}>
        <div className={styles.heroCopy}>
          <div className={styles.heroEyebrow}>{tx('FIELD PERFORMANCE', 'PERFORMA LAPANGAN')}</div>
          <h1>{tx(`Hi, ${firstName}!`, `Hai, ${firstName}!`)} <span aria-hidden="true">👋</span></h1>
          <p>{tx("Here's what's happening in your territory today.", 'Ini yang sedang terjadi di teritori Anda hari ini.')}</p>

          <div className={`${styles.progressCard} ${mode.themeCard}`}>
            <div className={styles.progressIcon}><ShieldCheck aria-hidden="true" /></div>
            <div className={styles.progressBody}>
              <div className={styles.progressHead}>
                <span>{tx('Overall Progress', 'Progress Hari Ini')}</span>
                <strong>{progressPct}%</strong>
              </div>
              <div className={styles.progressTrack}><span style={{ width: `${progressPct}%` }} /></div>
              <div className={styles.progressMeta}>
                <span>⚡ {tx('Target', 'Target')} {targetToday}</span>
                <span>📖 {tx('Achieved', 'Tercapai')} {totalTodayActions}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.sun} />
          <div className={styles.cloudOne} />
          <div className={styles.cloudTwo} />
          <div className={styles.hillBack} />
          <div className={styles.hillFront} />
          <div className={styles.barn}><span /></div>
          <div className={styles.tree}><span /></div>
          <div className={styles.character}>CRL</div>
          <div className={styles.flag}>★</div>
          <div className={styles.heroActions}>
            <span className={styles.seasonPill}>🌼 {tx('Field Season', 'Musim Lapangan')}</span>
            <span className={styles.circleAction}><Bell size={18} /></span>
            <span className={styles.circleAction}><ShieldCheck size={18} /></span>
          </div>
        </div>
      </section>

      <section className={`${mode.fieldOnly} ${mode.fieldGrid}`} aria-label={tx('Live field operations', 'Operasional lapangan langsung')}>
        <Link href="/superadmin/agents" className={mode.fieldCard}>
          <span>{tx('Checked-in agents', 'Agen sudah check-in')}</span>
          <strong>{checkedInAgents}</strong>
          <small>{tx('of active field agents today', 'dari agen lapangan aktif hari ini')}</small>
        </Link>
        <Link href="/superadmin/visits" className={mode.fieldCard}>
          <span>{tx('Visits today', 'Kunjungan hari ini')}</span>
          <strong>{todayVisits.length}</strong>
          <small>{tx('live field activity', 'aktivitas lapangan langsung')}</small>
        </Link>
        <Link href="/superadmin/visits" className={mode.fieldCard}>
          <span>{tx('GPS mismatches', 'GPS tidak sesuai')}</span>
          <strong>{gpsMismatchToday}</strong>
          <small>{tx('needs validation', 'perlu validasi')}</small>
        </Link>
        <Link href="/superadmin/pre-visits" className={mode.fieldCard}>
          <span>{tx('Supervisor review', 'Tinjauan supervisor')}</span>
          <strong>{pendingReview}</strong>
          <small>{tx('pre-visits waiting today', 'pra-kunjungan menunggu hari ini')}</small>
        </Link>
      </section>

      <section aria-label={tl('superadmin.dashboard.statisticsAria')} className={`${styles.statsGrid} ${mode.generalOnly}`}>
        {stats.map(({ href, label, count, icon: Icon, tone }) => (
          <Link key={href} href={href} className={`${styles.statCard} ${styles[`tone_${tone}`]} ${mode.themeCard}`}>
            <div className={styles.statIcon}><Icon aria-hidden="true" /></div>
            <strong>{count.toLocaleString('id-ID')}</strong>
            <span>{label}</span>
            <small>↗ {tx('Open details', 'Buka detail')}</small>
          </Link>
        ))}
      </section>

      <section className={`${styles.block} ${mode.themeCard} ${mode.generalOnly}`}>
        <div className={styles.sectionHead}><h2>{tx('Quick Access', 'Akses Cepat')}</h2></div>
        <div className={styles.quickGrid}>
          {quickAccess.map(({ href, title, icon: Icon, tone }) => (
            <Link key={href} href={href} className={`${styles.quickCard} ${styles[`tone_${tone}`]} ${mode.themeCard}`}>
              <div className={styles.quickIcon}><Icon aria-hidden="true" /></div>
              <strong>{title}</strong>
              <ChevronRight aria-hidden="true" className={styles.quickArrow} />
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.lowerGrid}>
        <div className={`${styles.panel} ${mode.themeCard}`}>
          <div className={styles.sectionHead}>
            <h2>{tx('Agent Activity (Today)', 'Aktivitas Agen (Hari Ini)')}</h2>
            <Link href="/superadmin/agents">{tx('View all', 'Lihat semua')}</Link>
          </div>

          <div className={styles.activityList}>
            {agentActivity.map((item, index) => (
              <div key={item.email} className={styles.activityRow}>
                <div className={styles.avatar}>{String.fromCharCode(65 + index)}</div>
                <div className={styles.activityBody}>
                  <div className={styles.activityTop}><span>{item.agent_name || item.email}</span><strong>{item.visits} {tx('visits', 'kunjungan')}</strong></div>
                  <small>{item.email}</small>
                  <div className={styles.activityTrack}><span style={{ width: `${item.progress}%` }} /></div>
                </div>
                <span className={`${styles.activityBadge} ${item.visits === 0 ? styles.badgeDanger : item.progress < 60 ? styles.badgeWarn : styles.badgeSuccess}`}>{item.status}</span>
              </div>
            ))}
            {agentActivity.length === 0 && <div className={styles.empty}>{tx('No active agents.', 'Tidak ada agen aktif.')}</div>}
          </div>

          <Link href="/superadmin/agents" className={styles.primaryButton}>{tx('View All Agents', 'Lihat Semua Agen')} <ChevronRight size={17} /></Link>
        </div>

        <div className={styles.sideStack}>
          <div className={`${styles.panel} ${mode.themeCard}`}>
            <div className={styles.sectionHead}><h2>{tx('Pending Tasks', 'Tugas Tertunda')}</h2></div>
            <div className={styles.taskList}>
              <Link href="/superadmin/pre-visits" className={styles.taskRow}><span><ClipboardCheck size={18} />{tx('Pre-Visits to Review', 'Pra-Kunjungan untuk Ditinjau')}</span><strong className={styles.pillOrange}>{pendingReview}</strong></Link>
              <Link href="/superadmin/visits" className={styles.taskRow}><span><MapPin size={18} />{tx('Visits Today', 'Kunjungan Hari Ini')}</span><strong className={styles.pillBlue}>{todayVisits.length}</strong></Link>
              <Link href="/superadmin/visits" className={styles.taskRow}><span><Clock3 size={18} />{tx('Attendance Issues', 'Masalah Absensi')}</span><strong className={styles.pillPink}>{lateAttendance + attendanceMissing}</strong></Link>
            </div>
          </div>

          <div className={`${styles.panel} ${mode.themeCard}`}>
            <div className={styles.sectionHead}><h2>{tx('Field Notes', 'Catatan Lapangan')}</h2></div>
            <div className={styles.announcement}>
              <span className={styles.announcementIcon}>✦</span>
              <div><strong>{tx('Keep the route moving', 'Jaga ritme kunjungan')}</strong><p>{tx('Prioritize customers closest to churn and review exceptions before end of day.', 'Prioritaskan pelanggan yang paling dekat churn dan tinjau pengecualian sebelum akhir hari.')}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.block} ${mode.themeCard} ${mode.generalOnly}`}>
        <div className={styles.sectionHead}><h2>{tx('Recent Activities', 'Aktivitas Terbaru')}</h2></div>
        <div className={styles.recentWrap}>
          <div className={styles.recentList}>
            {recentItems.map((item, index) => (
              <div key={`${item.type}-${item.at}-${index}`} className={styles.recentRow}>
                <div className={styles.recentIcon}>{item.type === 'visit' ? <MapPin size={16} /> : <ClipboardList size={16} />}</div>
                <div><strong>{item.title}</strong><span>{item.subtitle}</span></div>
                <time>{formatTimeAgo(item.at, isId ? 'id' : 'en')}</time>
              </div>
            ))}
            {recentItems.length === 0 && <div className={styles.empty}>{tx('No recent activity.', 'Belum ada aktivitas terbaru.')}</div>}
          </div>
          <div className={styles.miniScene} aria-hidden="true"><div className={styles.miniHill} /><div className={styles.miniBarn} /><div className={styles.miniTree} /></div>
        </div>
      </section>
    </div>
  )
}
