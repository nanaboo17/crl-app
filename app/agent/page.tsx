import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Building2,
  ClipboardList,
  Clock3,
  ArrowRight,
  CheckCircle2,
  RefreshCcw,
  Trophy,
  Sparkles,
  LayoutDashboard,
  MapPin,
  Route,
  TicketCheck,
  UserRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import { getComplaintTickets } from '@/lib/complaints'
import AgentIncentiveCalculator from '@/components/agent/AgentIncentiveCalculator'
import styles from './page.module.css'

function jakartaMondayKey(now = new Date()) {
  // Group weeks by Monday in Asia/Jakarta, even when the server runs in UTC.
  const today = jakartaDateKey(now)
  const [year, month, day] = today.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  const daysSinceMonday = (utc.getUTCDay() + 6) % 7
  utc.setUTCDate(utc.getUTCDate() - daysSinceMonday)
  return utc.toISOString().slice(0, 10)
}

function mondayPlusDays(monday: string, days: number) {
  const date = new Date(`${monday}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

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

  const { data: agent, error } = await supabase.from('agents').select('email,agent_name,role,active').ilike('email', email).maybeSingle()
  if (error) return <div className={styles.page}><div className="dui-alert dui-alert-error">{t('agent.dashboard.accountError', { message: error.message })}</div></div>
  if (!agent) return <div className={styles.page}><div className="dui-alert dui-alert-warning">{t('agent.dashboard.agentNotFound', { email })}</div></div>
  if (!agent.active) return <div className={styles.page}><div className="dui-alert dui-alert-error">{t('agent.dashboard.accountInactive')}</div></div>
  if (agent.role !== 'agent') redirect('/auth/route')

  const [customersResult, preVisitsResult, visitsResult, customersList, followupsResult, visitDetailsResult, complaintCustomersResult] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('agent_email', email).eq('actionable', true),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }).eq('agent_email', email),
    supabase.from('visits').select('*', { count: 'exact', head: true }).eq('agent_email', email),
    supabase.from('customers').select('crl_id,customer_id,customer_name,priority_rank,days_left_to_churn,invoice_amount,payment_status,visit_status,city,district,sub_district').eq('agent_email', email).eq('actionable', true),
    supabase.from('customer_followups').select('followup_id,crl_id,customer_id,due_at,note,status').eq('agent_email', email).eq('status', 'pending').order('due_at', { ascending: true }).limit(5),
    supabase.from('visits').select('visit_id,crl_id,customer_id,visit_date,location_match,visit_photo_url,consent_given,conversation_result,updated_phone').eq('agent_email', email).order('visit_date', { ascending: false }),
    supabase.from('customers').select('customer_id,customer_name').eq('agent_email', email),
  ])

  let complaintTickets: Awaited<ReturnType<typeof getComplaintTickets>> = []
  let complaintLoadError = ''
  try {
    complaintTickets = await getComplaintTickets((complaintCustomersResult.data || []).map((row: any) => row.customer_id))
  } catch (complaintError) {
    complaintLoadError = complaintError instanceof Error ? complaintError.message : String(complaintError)
  }

  const complaintCustomerMap = new Map(
    (complaintCustomersResult.data || []).map((row: any) => [String(row.customer_id), row.customer_name || ''])
  )

  const firstName = agent.agent_name?.trim().split(/\s+/)[0] ?? 'Agent'
  const stats = [
    { href: '/agent/customers', label: t('agent.dashboard.statCustomers'), count: customersResult.count ?? 0, icon: Building2 },
    { href: '/agent/route', label: t('agent.dashboard.statRoute'), count: (customersList.data || []).filter((c: any) => (c.visit_status ?? '').toLowerCase() !== 'visited').length, icon: Route },
    { href: '/agent/pre-visits', label: t('agent.dashboard.statPreVisits'), count: preVisitsResult.count ?? 0, icon: ClipboardList },
    { href: '/agent/visits', label: t('agent.dashboard.statVisits'), count: visitsResult.count ?? 0, icon: MapPin },
    { href: '/agent/complaints', label: tx('Complaint Tickets', 'Tiket Keluhan'), count: complaintTickets.length, icon: TicketCheck },
  ]

  // This is a preview of documented visits, NOT the final commission-valid visit count.
  // Billing timestamps, GPS-distance validation and payouts require separate verification.
  const allVisits = visitDetailsResult.data ?? []
  const monthKey = jakartaDateKey(new Date()).slice(0, 7)
  const monthVisits = allVisits.filter((row: any) => row.visit_date && jakartaDateKey(row.visit_date).startsWith(monthKey))
  const evidencedVisits = monthVisits.filter((row: any) => row.location_match === true && Boolean(row.visit_photo_url)).length
  // Weekly challenge counts distinct customer cases with a recorded recovery
  // conversation and supporting visit evidence; it is NOT a billing-verified save.
  const monday = jakartaMondayKey()
  const nextMonday = mondayPlusDays(monday, 7)
  const weeklyRecoveryCases = new Set(
    allVisits
      .filter((visit: any) => {
        if (!visit.visit_date) return false
        const visitDay = jakartaDateKey(visit.visit_date)
        const hasEvidence = visit.location_match === true && Boolean(visit.visit_photo_url)
        const recoveryResult = ['Sudah melakukan pembayaran', 'Bersedia bayar / Promise to Pay'].includes(
          String(visit.conversation_result ?? '').trim()
        )
        return visitDay >= monday && visitDay < nextMonday && hasEvidence && recoveryResult
      })
      .map((visit: any) => String(visit.crl_id || (visit.customer_id ? `customer:${visit.customer_id}` : '')))
      .filter(Boolean)
  )
  const weeklyRecoveryCount = weeklyRecoveryCases.size
  const weeklyRecoveryTarget = 3
  const weeklyRecoveryProgress = Math.min(100, Math.round(weeklyRecoveryCount / weeklyRecoveryTarget * 100))
  const weeklyRecoveryRemaining = Math.max(0, weeklyRecoveryTarget - weeklyRecoveryCount)
  const weeklyBadgeEarned = weeklyRecoveryCount >= weeklyRecoveryTarget

  const unlockTarget = 165 // Full-month proposal: 50% of 330; prorating needs verified first check-in.
  const fullTarget = 330
  const progress = Math.min(100, Math.round(evidencedVisits / fullTarget * 100))
  const remaining = Math.max(0, unlockTarget - evidencedVisits)
  const milestones = [50, 100, 165, 250, 330]
  const nextMilestone = milestones.find((value) => evidencedVisits < value)
  const nextRemaining = nextMilestone ? nextMilestone - evidencedVisits : 0
  const encouragement = evidencedVisits >= fullTarget
    ? tx('Amazing! You reached the full monthly milestone.', 'Luar biasa! Kamu mencapai target penuh bulan ini.')
    : evidencedVisits >= unlockTarget
      ? tx('Great progress! Keep going toward 330.', 'Keren! Lanjutkan sampai 330 kunjungan.')
      : evidencedVisits >= 100
        ? tx('So close! Keep the momentum going.', 'Sudah dekat! Sedikit lagi menuju unlock.')
        : evidencedVisits >= 50
          ? tx('Nice work! You are building momentum.', 'Bagus! Progresmu terus bertambah.')
          : tx('Every quality visit brings you closer.', 'Setiap kunjungan valid bikin kamu makin dekat.')
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

      <AgentIncentiveCalculator evidenceVisits={evidencedVisits} locale="id" />

      <section className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm sm:p-6" aria-label={tx('Monthly recovery journey', 'Progres CRL bulan ini')}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">{tx('Your monthly progress', 'Progres bulan ini')}</p>
            <h2 className="mt-1 text-xl font-bold">{encouragement}</h2>
            <p className="mt-1 text-sm text-base-content/65">{tx('Track documented visits and your next action.', 'Pantau kunjungan berbukti dan langkah berikutnya.')}</p>
          </div>
          <span className="dui-badge dui-badge-outline">{tx('Staging preview', 'Uji coba staging')}</span>
        </div>
        <div className="rounded-2xl bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-base-content/70">{tx('Visits with GPS match and photo, this month', 'Kunjungan dengan GPS cocok dan foto, bulan ini')}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">{evidencedVisits} <span className="text-base font-medium text-base-content/55">/ {fullTarget}</span></p>
            </div>
            <span className={`dui-badge ${remaining === 0 ? 'dui-badge-success' : 'dui-badge-warning'}`}>
              {remaining === 0 ? tx('165-visit milestone reached', 'Milestone 165 tercapai') : tx(`${remaining} visits to 165`, `Kurang ${remaining} ke 165`)}
            </span>
          </div>
          <div className="relative mt-4">
            <div className="h-3 overflow-hidden rounded-full bg-base-300" role="progressbar" aria-valuenow={Math.min(evidencedVisits, fullTarget)} aria-valuemin={0} aria-valuemax={fullTarget} aria-label={tx('Progress toward monthly target', 'Progres menuju target bulanan')}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="pointer-events-none absolute -top-1 bottom-[-4px] left-1/2 w-0.5 bg-base-content/50" aria-hidden="true" />
          </div>
          <div className="mt-2 flex justify-between text-xs text-base-content/60"><span>0</span><span>{tx('165 · Unlock proposal', '165 · Usulan unlock')}</span><span>330</span></div>
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={tx('Visit milestones', 'Pencapaian kunjungan')}>
            {milestones.map((milestone) => (
              <span key={milestone} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${evidencedVisits >= milestone ? 'border-success/30 bg-success/10 text-success' : milestone === nextMilestone ? 'border-primary/30 bg-primary/10 text-primary' : 'border-base-300 bg-base-100 text-base-content/55'}`}>
                {evidencedVisits >= milestone ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {milestone}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-base-content">{nextMilestone
            ? tx(`Next goal: ${nextRemaining} more evidenced visits to ${nextMilestone}!`, `Target berikutnya: ${nextRemaining} kunjungan lagi untuk mencapai ${nextMilestone}!`)
            : tx('All visit milestones completed. Keep helping customers recover!', 'Semua milestone kunjungan tercapai. Lanjutkan bantu pelanggan!')}</p>
          <p className="mt-2 text-xs text-base-content/60">{tx('165 visits is the proposed full-month unlock threshold. Final validity, prorated target and payment still need verification.', '165 kunjungan adalah batas unlock usulan untuk bulan penuh. Validitas akhir, target prorata, dan pembayaran tetap perlu diverifikasi.')}</p>
        </div>
        <p className="mt-4 text-sm font-semibold">{tx('Your next move', 'Langkah berikutnya')}</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Link href="/agent/customers" className="group flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
            <div>
              <div className="flex items-center gap-2 font-bold"><RefreshCcw className="h-4 w-4 text-primary" aria-hidden="true" />{tx('Follow up Re-Engagement', 'Follow-up Re-Engagement')}</div>
              <p className="mt-1 text-xs text-base-content/70">{tx('Help customers at risk of churn.', 'Bantu pelanggan yang masih berisiko churn.')}</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link href="/agent/visits" className="group flex items-center justify-between gap-3 rounded-2xl border border-base-300 p-4 transition-colors hover:bg-base-200/60">
            <div>
              <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />{tx('Review your visits', 'Lihat kunjunganmu')}</div>
              <p className="mt-1 text-xs text-base-content/70">{tx('Check field visits and supporting evidence.', 'Cek hasil visit dan bukti kunjungan.')}</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-base-content/50 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-base-content/60">{tx('Commission preview: Rp20,000 for a verified call save or Rp50,000 for a verified visit save, subject to approved rules. Earnings are not calculated here yet.', 'Gambaran komisi: Rp20.000 untuk save via telepon atau Rp50.000 untuk save setelah visit yang terverifikasi, sesuai aturan yang disetujui. Nominal penghasilan belum dihitung otomatis.')}</p>
      </section>

      <section className="rounded-3xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-5" aria-label={tx('Recovery challenge of the week', 'Tantangan Recovery Minggu Ini')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning"><Trophy className="h-6 w-6" aria-hidden="true" /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{tx('Weekly Challenge', 'Tantangan Mingguan')}</p>
              <h2 className="mt-1 text-lg font-bold">{tx('Recovery of the Week', 'Recovery Minggu Ini')}</h2>
              <p className="mt-1 text-sm text-base-content/65">{weeklyBadgeEarned
                ? tx('Great work! You reached your weekly recovery-action goal.', 'Keren! Target progres recovery minggu ini tercapai.')
                : weeklyRecoveryCount === 0
                  ? tx('Start with one customer you can help toward payment.', 'Mulai dari satu pelanggan yang bisa kamu bantu menuju pembayaran.')
                  : tx(`Just ${weeklyRecoveryRemaining} more customers to your weekly badge!`, `Tinggal ${weeklyRecoveryRemaining} pelanggan lagi untuk badge mingguan!`)}</p>
            </div>
          </div>
          {weeklyBadgeEarned ? <span className="dui-badge dui-badge-success gap-1"><Sparkles className="h-3 w-3" aria-hidden="true" />{tx('Badge earned', 'Badge tercapai')}</span> : null}
        </div>
        <div className="mt-4 rounded-2xl bg-base-200/65 p-4">
          <div className="flex items-end justify-between gap-3">
            <div><strong className="text-2xl font-extrabold tabular-nums">{weeklyRecoveryCount} <span className="text-base font-medium text-base-content/55">/ {weeklyRecoveryTarget}</span></strong><p className="text-xs text-base-content/65">{tx('Customers with evidenced recovery progress this week', 'Pelanggan dengan progres recovery berbukti minggu ini')}</p></div>
            <span className="text-xs font-semibold text-base-content/70">{Math.min(weeklyRecoveryCount, weeklyRecoveryTarget)}/{weeklyRecoveryTarget}</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-base-300" role="progressbar" aria-label={tx('Weekly recovery challenge progress', 'Progres tantangan recovery mingguan')} aria-valuemin={0} aria-valuemax={weeklyRecoveryTarget} aria-valuenow={Math.min(weeklyRecoveryCount, weeklyRecoveryTarget)}>
            <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${weeklyRecoveryProgress}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-base-content/65">{tx('Milestones:', 'Milestone:')}</span>
            {[1, 2, 3].map((milestone) => <span key={milestone} className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${weeklyRecoveryCount >= milestone ? 'border-success/30 bg-success/10 text-success' : 'border-base-300 bg-base-100 text-base-content/55'}`}>{weeklyRecoveryCount >= milestone ? <CheckCircle2 className="h-4 w-4" aria-label={tx('Complete', 'Selesai')} /> : milestone}</span>)}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-xs text-base-content/65">{tx('Counts unique customers with GPS-matched photo visits and recorded Paid/PTP outcomes, Monday–Sunday (Jakarta). Not a verified save or commission; billing must confirm payment.', 'Menghitung pelanggan unik dengan kunjungan GPS cocok, foto, dan hasil Paid/PTP tercatat, Senin–Minggu (WIB). Ini bukan save atau komisi terverifikasi; pembayaran harus dikonfirmasi billing.')}</p>
          <Link href="/agent/customers" className="dui-btn dui-btn-primary dui-btn-sm gap-2">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />{tx('Follow up Re-Engagement', 'Follow-up Re-Engagement')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

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

      <section className={styles.panel} aria-label={tx('Complaint tickets', 'Tiket keluhan')}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{tx('Complaint Tickets', 'Tiket Keluhan')}</h2>
            <p>{tx('Tickets matched to your assigned customers by Billing ID (BA).', 'Tiket yang cocok dengan pelanggan yang ditugaskan berdasarkan Billing ID (BA).')}</p>
          </div>
          <Link href="/agent/complaints">{tx('View all', 'Lihat semua')}</Link>
        </div>
        {complaintLoadError ? (
          <div className={styles.empty}>{tx('Complaint data is temporarily unavailable.', 'Data keluhan sementara tidak tersedia.')}</div>
        ) : complaintTickets.length === 0 ? (
          <div className={styles.empty}>{tx('No complaint tickets for your assigned customers.', 'Tidak ada tiket keluhan untuk pelanggan yang ditugaskan.')}</div>
        ) : (
          <div className={styles.followupList}>
            {complaintTickets.slice(0, 5).map((ticket: any, index: number) => (
              <Link
                key={`${ticket.billingId}-${ticket.ticketNumber}-${ticket.no}-${index}`}
                href={`/agent/complaints#ticket-${encodeURIComponent(ticket.billingId)}-${index}`}
                className={styles.followupItem}
              >
                <strong>{complaintCustomerMap.get(ticket.billingId) || ticket.custName || ticket.billingId}</strong>
                <span>{ticket.ticketNumber || tx('No ticket number', 'Belum ada nomor tiket')} · {ticket.status || tx('No status', 'Belum ada status')}</span>
                <span>{ticket.billingId}{ticket.issueType ? ` · ${ticket.issueType}` : ''}</span>
              </Link>
            ))}
          </div>
        )}
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
              return <Link href={`/agent/customers/${encodeURIComponent(customer.crl_id)}`} key={customer.crl_id} className={styles.planCard}>
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
              return <Link href={`/agent/customers/${encodeURIComponent(row.crl_id)}`} key={row.followup_id} className={`${styles.followupItem} ${overdue ? styles.overdue : ''}`}><strong>{row.note}</strong><span>{overdue ? tx('Overdue · ', 'Terlambat · ') : ''}{new Date(row.due_at).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB')}</span><span>{row.customer_id}</span></Link>
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
