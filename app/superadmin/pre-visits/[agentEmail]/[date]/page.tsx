import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, ShieldAlert, Sparkles, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import styles from './page.module.css'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

const PREVISIT_STATUS_KEYS: Record<string, string> = {
  'ready for visit': 'superadmin.status.readyForVisit',
  'need follow-up': 'superadmin.status.needFollowup',
  'supervisor review': 'superadmin.status.supervisorReview',
}

function previsitStatusKey(value: string | null | undefined): string | null {
  if (!value) return null
  return PREVISIT_STATUS_KEYS[value.toLowerCase()] ?? null
}

export default async function AgentDailyPreVisitsPage({ params }: { params: Promise<{ agentEmail: string; date: string }> }) {
  const { agentEmail, date } = await params
  const decodedEmail = decodeURIComponent(agentEmail)
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, allMessages, key, params)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', user.email.trim().toLowerCase()).maybeSingle()
  if (!currentUser || !currentUser.active || !['admin', 'superadmin'].includes(currentUser.role)) redirect('/auth/route')

  const { data: agent } = await supabase.from('agents').select('email, agent_name, sales_code').eq('email', decodedEmail).maybeSingle()
  if (!agent) return <main className={styles.page}><div className={styles.errorCard}>{t('superadmin.preVisits.daily.notFound')}</div></main>

  const startDate = `${date}T00:00:00+07:00`
  const endDate = `${date}T23:59:59.999+07:00`
  const { data: preVisits, error } = await supabase.from('pre_visits').select('previsit_id,customer_id,contact_attempt_date,contact_confirmed,address_confirmed,appointment_confirmed,appointment_date,contact_result,previsit_status,confirmed_address,landmark,previsit_notes').eq('agent_email', decodedEmail).gte('contact_attempt_date', startDate).lte('contact_attempt_date', endDate).order('contact_attempt_date', { ascending: false })
  if (error) return <main className={styles.page}><div className={styles.errorCard}>{error.message}</div></main>

  const customerIds = [...new Set((preVisits ?? []).map((item) => item.customer_id))]
  let customers: any[] = []
  if (customerIds.length > 0) {
    const { data } = await supabase.from('customers').select('customer_id,customer_name,phone_number,city,district,sub_district,service_address,customer_status,visit_status').in('customer_id', customerIds)
    customers = data ?? []
  }

  const customerMap = new Map(customers.map((customer) => [customer.customer_id, customer]))
  const total = preVisits?.length ?? 0
  const readyCount = preVisits?.filter((item) => item.previsit_status === 'Ready for Visit').length ?? 0
  const followUpCount = preVisits?.filter((item) => item.previsit_status === 'Need Follow-up').length ?? 0
  const reviewCount = preVisits?.filter((item) => item.previsit_status === 'Supervisor Review').length ?? 0
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const summaries = [
    { label: t('superadmin.preVisits.daily.total'), value: total, icon: ClipboardList, tone: 'purple' },
    { label: t('superadmin.preVisits.daily.ready'), value: readyCount, icon: CheckCircle2, tone: 'green' },
    { label: t('superadmin.preVisits.daily.followUp'), value: followUpCount, icon: Clock3, tone: 'yellow' },
    { label: t('superadmin.preVisits.daily.review'), value: reviewCount, icon: ShieldAlert, tone: 'red' },
  ]

  return (
    <main className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: tx('Pre-Visits', 'Pra-Kunjungan'), href: '/superadmin/pre-visits', icon: ClipboardList },
          { label: agent.agent_name || agent.email, href: `/superadmin/pre-visits/${encodeURIComponent(decodedEmail)}`, icon: UserRound },
          { label: dateLabel, icon: CalendarDays },
        ]}
        title={agent.agent_name}
        description={`${dateLabel} · ${agent.email}`}
      />

      <section className={styles.hero}>
        <div><span><Sparkles aria-hidden="true" />{tx('DAILY PRE-VISIT', 'PRA-KUNJUNGAN HARIAN')}</span><h2>{tx('See who is ready before the field visit starts.', 'Lihat siapa yang siap sebelum kunjungan lapangan dimulai.')}</h2><p>{tx('Scan readiness, follow-ups, supervisor review, and each customer preparation record for this day.', 'Pantau kesiapan, tindak lanjut, review supervisor, dan setiap catatan persiapan pelanggan pada hari ini.')}</p></div>
        <div className={styles.heroDate}><CalendarDays aria-hidden="true" /><strong>{date}</strong><span>{tx('Jakarta time', 'Waktu Jakarta')}</span></div>
      </section>

      <section className={styles.statsGrid}>
        {summaries.map(({ label, value, icon: Icon, tone }) => <article key={label} className={`${styles.statCard} ${styles[`tone_${tone}`]}`}><div className={styles.statIcon}><Icon aria-hidden="true" /></div><strong>{value}</strong><span>{label}</span></article>)}
      </section>

      <section className={styles.historyCard}>
        <div className={styles.sectionHeader}><div><span>{tx('CUSTOMER PREPARATION', 'PERSIAPAN PELANGGAN')}</span><h2>{tx('Pre-visit records', 'Catatan pra-kunjungan')}</h2></div><p>{tx('Open a customer record to review the full pre-visit details.', 'Buka catatan pelanggan untuk melihat detail pra-kunjungan lengkap.')}</p></div>
        <div className={styles.list}>
          {preVisits && preVisits.length > 0 ? preVisits.map((preVisit) => {
            const customer = customerMap.get(preVisit.customer_id)
            const statusKey = previsitStatusKey(preVisit.previsit_status)
            return (
              <Link key={preVisit.previsit_id} href={`/superadmin/pre-visits/${encodeURIComponent(decodedEmail)}/${date}/${encodeURIComponent(preVisit.previsit_id)}`} className={styles.preVisitCard}>
                <div className={styles.cardTop}><div><span className={styles.preVisitId}>{preVisit.previsit_id}</span><h2>{customer?.customer_name || preVisit.customer_id}</h2><p>{preVisit.customer_id} · {customer?.sub_district || customer?.district || customer?.city || '-'}</p></div><span className={styles.arrow}>›</span></div>
                <div className={styles.infoGrid}>
                  <div><span>{t('superadmin.preVisits.daily.contactResult')}</span><strong>{preVisit.contact_result || '-'}</strong></div>
                  <div><span>{t('superadmin.preVisits.daily.preVisitStatus')}</span><strong>{statusKey ? t(statusKey) : preVisit.previsit_status || '-'}</strong></div>
                  <div><span>{t('superadmin.preVisits.daily.contact')}</span><strong>{preVisit.contact_confirmed ? t('superadmin.status.confirmed') : t('superadmin.status.notConfirmed')}</strong></div>
                  <div><span>{t('superadmin.preVisits.daily.address')}</span><strong>{preVisit.address_confirmed ? t('superadmin.status.confirmed') : t('superadmin.status.notConfirmed')}</strong></div>
                  <div><span>{t('superadmin.preVisits.daily.appointment')}</span><strong>{preVisit.appointment_confirmed ? t('superadmin.status.confirmed') : t('superadmin.status.notConfirmed')}</strong></div>
                  <div><span>{t('superadmin.preVisits.daily.area')}</span><strong>{customer?.sub_district || customer?.district || customer?.city || '-'}</strong></div>
                </div>
                <div className={styles.footer}><span>{new Date(preVisit.contact_attempt_date).toLocaleTimeString(locale === 'id' ? 'id-ID' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}</span><span className={preVisit.previsit_status === 'Ready for Visit' ? styles.readyBadge : preVisit.previsit_status === 'Need Follow-up' ? styles.followBadge : preVisit.previsit_status === 'Supervisor Review' ? styles.reviewBadge : styles.pendingBadge}>{statusKey ? t(statusKey) : preVisit.previsit_status}</span></div>
              </Link>
            )
          }) : <div className={styles.emptyState}><h2>{t('superadmin.preVisits.daily.emptyTitle')}</h2><p>{t('superadmin.preVisits.daily.emptyDesc')}</p></div>}
        </div>
      </section>
    </main>
  )
}
