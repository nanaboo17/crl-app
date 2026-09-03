import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, ClipboardList, Clock3, LayoutDashboard, MapPin, Route, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

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

  const [customersResult, preVisitsResult, visitsResult, customersList, followupsResult] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('agent_email', email),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }).eq('agent_email', email),
    supabase.from('visits').select('*', { count: 'exact', head: true }).eq('agent_email', email),
    supabase.from('customers').select('customer_id,customer_name,priority_rank,days_left_to_churn,invoice_amount,payment_status,visit_status,city,district,sub_district').eq('agent_email', email),
    supabase.from('customer_followups').select('followup_id,customer_id,due_at,note,status').eq('agent_email', email).eq('status', 'pending').order('due_at', { ascending: true }).limit(5),
  ])

  const firstName = agent.agent_name?.trim().split(/\s+/)[0] ?? 'Agent'
  const stats = [
    { href: '/agent/customers', label: t('agent.dashboard.statCustomers'), count: customersResult.count ?? 0, icon: Building2 },
    { href: '/agent/route', label: t('agent.dashboard.statRoute'), count: (customersList.data || []).filter((c: any) => (c.visit_status ?? '').toLowerCase() !== 'visited').length, icon: Route },
    { href: '/agent/pre-visits', label: t('agent.dashboard.statPreVisits'), count: preVisitsResult.count ?? 0, icon: ClipboardList },
    { href: '/agent/visits', label: t('agent.dashboard.statVisits'), count: visitsResult.count ?? 0, icon: MapPin },
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
