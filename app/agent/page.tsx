import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  Clock3,
  Flame,
  LayoutDashboard,
  MapPin,
  Medal,
  Route,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

const LEVEL_XP = 250

function jakartaDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export default async function AgentPage() {
  const supabase = await createClient()
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, allMessages, key, params)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const email = user.email.trim().toLowerCase()

  const { data: agent, error } = await supabase.from('agents').select('email,agent_name,sales_code,role,active').eq('email', email).maybeSingle()
  if (error) return <div className={styles.page}><div className="dui-alert dui-alert-error">{t('agent.dashboard.accountError', { message: error.message })}</div></div>
  if (!agent) return <div className={styles.page}><div className="dui-alert dui-alert-warning">{t('agent.dashboard.agentNotFound', { email })}</div></div>
  if (!agent.active) return <div className={styles.page}><div className="dui-alert dui-alert-error">{t('agent.dashboard.accountInactive')}</div></div>
  if (agent.role !== 'agent') redirect('/auth/route')

  const [customersResult, preVisitsResult, visitsResult, customersList, followupsResult, visitDetailsResult, attendanceResult] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('agent_email', email),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }).eq('agent_email', email),
    supabase.from('visits').select('*', { count: 'exact', head: true }).eq('agent_email', email),
    supabase.from('customers').select('customer_id,customer_name,priority_rank,days_left_to_churn,invoice_amount,payment_status,visit_status,city,district,sub_district').eq('agent_email', email),
    supabase.from('customer_followups').select('followup_id,customer_id,due_at,note,status').eq('agent_email', email).eq('status', 'pending').order('due_at', { ascending: true }).limit(5),
    supabase.from('visits').select('visit_id,visit_date,location_match,visit_photo_url,consent_given,conversation_result,updated_phone').eq('agent_email', email).order('visit_date', { ascending: false }),
    supabase.from('agent_attendance').select('attendance_date,check_in_status,check_in_at,check_out_at,worked_minutes').eq('agent_email', email).order('attendance_date', { ascending: false }),
  ])

  const firstName = agent.agent_name?.trim().split(/\s+/)[0] ?? 'Agent'
  const stats = [
    { href: '/agent/customers', label: t('agent.dashboard.statCustomers'), count: customersResult.count ?? 0, icon: Building2 },
    { href: '/agent/route', label: t('agent.dashboard.statRoute'), count: (customersList.data || []).filter((c: any) => (c.visit_status ?? '').toLowerCase() !== 'visited').length, icon: Route },
    { href: '/agent/pre-visits', label: t('agent.dashboard.statPreVisits'), count: preVisitsResult.count ?? 0, icon: ClipboardList },
    { href: '/agent/visits', label: t('agent.dashboard.statVisits'), count: visitsResult.count ?? 0, icon: MapPin },
  ]

  const allVisits = visitDetailsResult.data ?? []
  const attendance = attendanceResult.data ?? []
  const todayKey = jakartaDateKey(new Date())
  const todayVisits = allVisits.filter((row: any) => jakartaDateKey(row.visit_date) === todayKey)
  const todayAttendance = attendance.find((row: any) => row.attendance_date === todayKey)

  const isProductive = (row: any) => row.location_match !== false && Boolean(row.visit_photo_url) && row.consent_given === true
  const productiveVisits = allVisits.filter(isProductive).length
  const productiveToday = todayVisits.filter(isProductive).length
  const phoneValidations = allVisits.filter((row: any) => Boolean(row.updated_phone)).length
  const phoneValidationsToday = todayVisits.filter((row: any) => Boolean(row.updated_phone)).length
  const paidResults = allVisits.filter((row: any) => row.conversation_result === 'Sudah melakukan pembayaran').length
  const recoveryToday = todayVisits.filter((row: any) => ['Sudah melakukan pembayaran', 'Bersedia bayar / Promise to Pay'].includes(row.conversation_result)).length
  const onTimeAttendance = attendance.filter((row: any) => (row.check_in_status ?? '').toLowerCase() === 'on time').length

  let onTimeStreak = 0
  for (const row of attendance) {
    if ((row.check_in_status ?? '').toLowerCase() !== 'on time') break
    onTimeStreak += 1
  }

  const totalXp =
    productiveVisits * 30 +
    phoneValidations * 10 +
    paidResults * 20 +
    allVisits.filter((row: any) => row.conversation_result === 'Bersedia bayar / Promise to Pay').length * 10 +
    onTimeAttendance * 20
  const level = Math.floor(totalXp / LEVEL_XP) + 1
  const xpIntoLevel = totalXp % LEVEL_XP
  const xpToNext = LEVEL_XP - xpIntoLevel
  const levelProgress = Math.round((xpIntoLevel / LEVEL_XP) * 100)

  const missions = [
    {
      label: tx('Check in on time', 'Check-in tepat waktu'),
      progress: todayAttendance && (todayAttendance.check_in_status ?? '').toLowerCase() === 'on time' ? 1 : 0,
      target: 1,
      xp: 20,
    },
    { label: tx('Complete productive visits', 'Selesaikan kunjungan produktif'), progress: productiveToday, target: 4, xp: 30 },
    { label: tx('Validate customer phones', 'Validasi nomor pelanggan'), progress: phoneValidationsToday, target: 2, xp: 10 },
    { label: tx('Secure paid / Promise to Pay', 'Dapatkan Paid / Promise to Pay'), progress: recoveryToday, target: 1, xp: 20 },
  ]

  const badges = [
    { label: tx('Early Starter', 'Mulai Tepat Waktu'), unlocked: onTimeAttendance >= 1, icon: Clock3 },
    { label: tx('GPS Verified', 'GPS Terverifikasi'), unlocked: productiveVisits >= 5, icon: MapPin },
    { label: tx('Data Cleaner', 'Data Cleaner'), unlocked: phoneValidations >= 3, icon: BadgeCheck },
    { label: tx('3-Day Streak', 'Streak 3 Hari'), unlocked: onTimeStreak >= 3, icon: Flame },
    { label: tx('Recovery Win', 'Recovery Win'), unlocked: paidResults >= 1, icon: Trophy },
  ]

  const scoreCustomer = (c: any) => {
    const priorityScore = Math.max(0, 6 - Number(c.priority_rank ?? 5)) * 24
    const churn = Number(c.days_left_to_churn ?? 999)
    const churnScore = churn <= 0 ? 45 : churn <= 3 ? 38 : churn <= 7 ? 30 : churn <= 14 ? 16 : 0
    const unpaidScore = (c.payment_status ?? '').toLowerCase() === 'paid' ? 0 : 20
    const amountScore = Math.min(20, Math.floor(Number(c.invoice_amount ?? 0) / 250000))
    return priorityScore + churnScore + unpaidScore + amountScore
  }

  const todayPlan = (customersList.data || [])
    .filter((c: any) => (c.visit_status ?? '').trim().toLowerCase() !== 'visited')
    .sort((a: any, b: any) => scoreCustomer(b) - scoreCustomer(a))
    .slice(0, 5)

  const now = Date.now()

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[{ label: t('agent.dashboard.breadcrumbAgent'), href: '/agent', icon: UserRound }, { label: t('agent.dashboard.breadcrumbDashboard'), icon: LayoutDashboard }]}
        title={t('agent.dashboard.title')}
        description={t('agent.dashboard.description', { name: firstName })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/agent/attendance" className="dui-btn dui-btn-outline dui-btn-sm gap-2">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {tx('Attendance', 'Absensi')}
            </Link>
            <Link href="/agent/customers" className="dui-btn dui-btn-primary dui-btn-sm">{t('agent.dashboard.myCustomers')}</Link>
          </div>
        }
      />

      <section className={styles.gameHero} aria-label={tx('Field progress', 'Progres lapangan')}>
        <div className={styles.levelBlock}>
          <div className={styles.levelIcon}><Sparkles className="h-6 w-6" aria-hidden="true" /></div>
          <div className={styles.levelCopy}>
            <span>{tx(`Level ${level} · Field Specialist`, `Level ${level} · Field Specialist`)}</span>
            <strong>{totalXp.toLocaleString()} XP</strong>
            <div className={styles.progressTrack} aria-label={`${levelProgress}%`}>
              <span style={{ width: `${levelProgress}%` }} />
            </div>
            <small>{tx(`${xpToNext} XP to Level ${level + 1}`, `${xpToNext} XP menuju Level ${level + 1}`)}</small>
          </div>
        </div>
        <div className={styles.streakBlock}>
          <Flame className="h-6 w-6" aria-hidden="true" />
          <div><strong>{onTimeStreak}</strong><span>{tx('on-time streak', 'streak tepat waktu')}</span></div>
        </div>
      </section>

      <div className={styles.gameGrid}>
        <section className={styles.gamePanel} aria-label={tx("Today's missions", 'Misi hari ini')}>
          <div className={styles.gamePanelHeader}><Target className="h-5 w-5" aria-hidden="true" /><div><h2>{tx("Today's Missions", 'Misi Hari Ini')}</h2><p>{tx('Earn XP by completing quality field actions.', 'Dapatkan XP dari aktivitas lapangan yang berkualitas.')}</p></div></div>
          <div className={styles.missionList}>
            {missions.map((mission) => {
              const complete = mission.progress >= mission.target
              return <div className={`${styles.missionItem} ${complete ? styles.missionComplete : ''}`} key={mission.label}>
                <span className={styles.missionCheck}>{complete ? '✓' : `${Math.min(mission.progress, mission.target)}/${mission.target}`}</span>
                <div><strong>{mission.label}</strong><small>+{mission.xp} XP</small></div>
              </div>
            })}
          </div>
        </section>

        <section className={styles.gamePanel} aria-label={tx('Badges', 'Badge')}>
          <div className={styles.gamePanelHeader}><Medal className="h-5 w-5" aria-hidden="true" /><div><h2>{tx('Badges', 'Badge')}</h2><p>{tx('Milestones earned from consistent field quality.', 'Pencapaian dari kualitas kerja lapangan yang konsisten.')}</p></div></div>
          <div className={styles.badgeGrid}>
            {badges.map(({ label, unlocked, icon: Icon }) => <div className={`${styles.badgeItem} ${unlocked ? styles.badgeUnlocked : ''}`} key={label}><Icon className="h-5 w-5" aria-hidden="true" /><span>{label}</span></div>)}
          </div>
        </section>
      </div>

      <section aria-label={t('agent.dashboard.statsAria')} className={styles.statsGrid}>
        {stats.map(({ href, label, count, icon: Icon }) => (
          <Link key={label} href={href} className={styles.statCard}>
            <div className={styles.statTop}>
              <div>
                <div className={styles.statLabel}>{label}</div>
                <div className={styles.statValue}>{count.toLocaleString()}</div>
              </div>
              <div className={styles.iconBox}>
                <Icon aria-hidden="true" className="h-5 w-5" />
              </div>
            </div>
            <div className={styles.statFooter}>{t('agent.dashboard.manage', { name: label.toLowerCase() })}</div>
          </Link>
        ))}
      </section>

      <div className={styles.sectionGrid}>
        <section className={styles.panel} aria-label={tx("Today's plan", 'Rencana hari ini')}>
          <div className={styles.panelHeader}>
            <div><h2>{tx("Today's Plan", 'Rencana Hari Ini')}</h2><p>{tx('Top customers ranked by priority, churn risk, unpaid status and invoice value.', 'Pelanggan teratas berdasarkan prioritas, risiko churn, status pembayaran, dan nilai tagihan.')}</p></div>
            <Link href="/agent/route">{tx('Open route', 'Buka rute')}</Link>
          </div>
          <div className={styles.planList}>
            {todayPlan.length === 0 ? <div className={styles.empty}>{tx('No customers need a visit today.', 'Tidak ada pelanggan yang perlu dikunjungi hari ini.')}</div> : todayPlan.map((customer: any, index: number) => {
              const area = customer.sub_district || customer.district || customer.city || '-'
              const churnUrgent = customer.days_left_to_churn !== null && customer.days_left_to_churn <= 7
              return <Link href={`/agent/customers/${encodeURIComponent(customer.customer_id)}`} key={customer.customer_id} className={styles.planCard}>
                <span className={styles.rank}>{index + 1}</span>
                <div className={styles.planMain}><strong>{customer.customer_name}</strong><span>{customer.customer_id} · {area}</span></div>
                <div className={styles.chips}><span className={styles.chip}>P{customer.priority_rank ?? '-'}</span>{churnUrgent && <span className={`${styles.chip} ${styles.urgent}`}>{customer.days_left_to_churn <= 0 ? tx('Churn overdue', 'Churn lewat') : `${customer.days_left_to_churn} ${tx('days', 'hari')}`}</span>}<span className={styles.chip}>Rp{Number(customer.invoice_amount ?? 0).toLocaleString('id-ID')}</span></div>
              </Link>
            })}
          </div>
        </section>

        <section className={styles.panel} aria-label={tx('Follow-up queue', 'Antrean tindak lanjut')}>
          <div className={styles.panelHeader}><div><h2>{tx('Follow-up Queue', 'Antrean Tindak Lanjut')}</h2><p>{tx('Upcoming calls, payment promises and revisits.', 'Telepon, janji pembayaran, dan kunjungan ulang yang akan datang.')}</p></div></div>
          <div className={styles.followupList}>
            {(followupsResult.data || []).length === 0 ? <div className={styles.empty}>{tx('No pending reminders.', 'Tidak ada pengingat tertunda.')}</div> : (followupsResult.data || []).map((row: any) => {
              const overdue = new Date(row.due_at).getTime() < now
              return <Link href={`/agent/customers/${encodeURIComponent(row.customer_id)}`} key={row.followup_id} className={`${styles.followupItem} ${overdue ? styles.overdue : ''}`}><strong>{row.note}</strong><span>{overdue ? tx('Overdue · ', 'Terlambat · ') : ''}{new Date(row.due_at).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB')}</span><span>{row.customer_id}</span></Link>
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
