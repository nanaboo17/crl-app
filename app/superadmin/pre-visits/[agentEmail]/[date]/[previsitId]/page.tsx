import { redirect } from 'next/navigation'
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, FileText, MapPin, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
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

export default async function AdminPreVisitDetailPage({ params }: { params: Promise<{ agentEmail: string; date: string; previsitId: string }> }) {
  const { agentEmail, date, previsitId } = await params
  const decodedEmail = decodeURIComponent(agentEmail)
  const decodedPrevisitId = decodeURIComponent(previsitId)
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, allMessages, key, params)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const currentEmail = user.email.trim().toLowerCase()
  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', currentEmail).maybeSingle()
  if (!currentUser || !currentUser.active || !['admin', 'superadmin'].includes(currentUser.role)) redirect('/auth/route')

  const { data: agent } = await supabase.from('agents').select('email,agent_name,sales_code').eq('email', decodedEmail).maybeSingle()
  const { data: preVisit, error: preVisitError } = await supabase.from('pre_visits').select('*').eq('previsit_id', decodedPrevisitId).eq('agent_email', decodedEmail).maybeSingle()

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  if (preVisitError || !preVisit) {
    return (
      <main className={styles.page}>
        <SuperadminPageHeader breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: tx('Pre-Visits', 'Pra-Kunjungan'), href: '/superadmin/pre-visits', icon: ClipboardList },
          { label: agent?.agent_name || decodedEmail, href: `/superadmin/pre-visits/${encodeURIComponent(decodedEmail)}`, icon: UserRound },
          { label: dateLabel, href: `/superadmin/pre-visits/${encodeURIComponent(decodedEmail)}/${date}`, icon: CalendarDays },
          { label: decodedPrevisitId, icon: FileText },
        ]} title={tx('Pre-Visit Detail', 'Detail Pra-Kunjungan')} description={decodedPrevisitId} />
        <div className={styles.errorCard}>{t('superadmin.preVisits.detail.notFound')}</div>
      </main>
    )
  }

  const { data: customer } = await supabase.from('customers').select('customer_id,customer_name,phone_number,alternative_phone_1,alternative_phone_2,alternative_phone_3,service_address,region,city,district,sub_district,customer_status,visit_status').eq('customer_id', preVisit.customer_id).maybeSingle()

  function formatDateTime(value: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const statusKey = previsitStatusKey(preVisit.previsit_status)
  const summaries = [
    { label: t('superadmin.preVisits.detail.preVisitStatus'), value: statusKey ? t(statusKey) : preVisit.previsit_status || '-', icon: CheckCircle2, tone: 'purple' },
    { label: t('superadmin.preVisits.detail.contactResult'), value: preVisit.contact_result || '-', icon: Clock3, tone: 'yellow' },
    { label: t('superadmin.preVisits.detail.contactAttempt'), value: formatDateTime(preVisit.contact_attempt_date), icon: CalendarDays, tone: 'blue' },
    { label: t('superadmin.preVisits.detail.agentName'), value: agent?.agent_name || decodedEmail, icon: UserRound, tone: 'green' },
  ]

  return (
    <main className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: tx('Pre-Visits', 'Pra-Kunjungan'), href: '/superadmin/pre-visits', icon: ClipboardList },
          { label: agent?.agent_name || decodedEmail, href: `/superadmin/pre-visits/${encodeURIComponent(decodedEmail)}`, icon: UserRound },
          { label: dateLabel, href: `/superadmin/pre-visits/${encodeURIComponent(decodedEmail)}/${date}`, icon: CalendarDays },
          { label: decodedPrevisitId, icon: FileText },
        ]}
        title={customer?.customer_name || preVisit.customer_id}
        description={`${decodedPrevisitId} · ${preVisit.customer_id}`}
      />

      <section className={styles.hero}>
        <div><span><Sparkles aria-hidden="true" />{tx('PRE-VISIT REVIEW', 'REVIEW PRA-KUNJUNGAN')}</span><h2>{tx('Everything needed before the field visit.', 'Semua yang dibutuhkan sebelum kunjungan lapangan.')}</h2><p>{tx('Review contact, address, appointment, supervisor approval, and customer context in one place.', 'Tinjau kontak, alamat, janji temu, persetujuan supervisor, dan konteks pelanggan dalam satu tempat.')}</p></div>
        <div className={styles.heroBadge}><ClipboardList aria-hidden="true" /><strong>{decodedPrevisitId}</strong><span>{preVisit.previsit_status || tx('Pre-visit', 'Pra-kunjungan')}</span></div>
      </section>

      <section className={styles.topGrid}>
        {summaries.map(({ label, value, icon: Icon, tone }) => <article key={label} className={`${styles.statusCard} ${styles[`tone_${tone}`]}`}><div className={styles.statusIcon}><Icon aria-hidden="true" /></div><span>{label}</span><strong>{value}</strong></article>)}
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.card}>
          <div className={styles.cardHead}><UserRound aria-hidden="true" /><h2>{t('superadmin.preVisits.detail.customerSection')}</h2></div>
          <div className={styles.grid}>
            <Detail label={t('superadmin.preVisits.detail.customerId')} value={customer?.customer_id} />
            <Detail label={t('superadmin.preVisits.detail.customerName')} value={customer?.customer_name} />
            <Detail label={t('superadmin.preVisits.detail.mainPhone')} value={customer?.phone_number} />
            <Detail label={t('superadmin.preVisits.detail.altPhone1')} value={customer?.alternative_phone_1} />
            <Detail label={t('superadmin.preVisits.detail.altPhone2')} value={customer?.alternative_phone_2} />
            <Detail label={t('superadmin.preVisits.detail.altPhone3')} value={customer?.alternative_phone_3} />
            <Detail label={t('superadmin.preVisits.detail.region')} value={customer?.region} />
            <Detail label={t('superadmin.preVisits.detail.city')} value={customer?.city} />
            <Detail label={t('superadmin.preVisits.detail.district')} value={customer?.district} />
            <Detail label={t('superadmin.preVisits.detail.subDistrict')} value={customer?.sub_district} />
            <Detail label={t('superadmin.preVisits.detail.serviceAddress')} value={customer?.service_address} full />
          </div>
        </section>

        <section className={styles.card}><div className={styles.cardHead}><UserRound aria-hidden="true" /><h2>{t('superadmin.preVisits.detail.agentSection')}</h2></div><div className={styles.grid}><Detail label={t('superadmin.preVisits.detail.agentName')} value={agent?.agent_name} /><Detail label={t('superadmin.preVisits.detail.salesCode')} value={agent?.sales_code} /><Detail label={t('superadmin.preVisits.detail.agentEmail')} value={decodedEmail} full /></div></section>
        <section className={styles.card}><div className={styles.cardHead}><Clock3 aria-hidden="true" /><h2>{t('superadmin.preVisits.detail.contactConfirmation')}</h2></div><div className={styles.grid}><Detail label={t('superadmin.preVisits.detail.contactAttempt')} value={formatDateTime(preVisit.contact_attempt_date)} /><Detail label={t('superadmin.preVisits.detail.contactConfirmed')} value={preVisit.contact_confirmed ? t('superadmin.status.yes') : t('superadmin.status.no')} /><Detail label={t('superadmin.preVisits.detail.contactResult')} value={preVisit.contact_result} full /></div></section>
        <section className={styles.card}><div className={styles.cardHead}><MapPin aria-hidden="true" /><h2>{t('superadmin.preVisits.detail.addressConfirmation')}</h2></div><div className={styles.grid}><Detail label={t('superadmin.preVisits.detail.addressConfirmed')} value={preVisit.address_confirmed ? t('superadmin.status.yes') : t('superadmin.status.no')} /><Detail label={t('superadmin.preVisits.detail.landmark')} value={preVisit.landmark} /><Detail label={t('superadmin.preVisits.detail.confirmedAddress')} value={preVisit.confirmed_address} full /></div></section>
        <section className={styles.card}><div className={styles.cardHead}><CalendarDays aria-hidden="true" /><h2>{t('superadmin.preVisits.detail.appointmentSection')}</h2></div><div className={styles.grid}><Detail label={t('superadmin.preVisits.detail.appointmentConfirmed')} value={preVisit.appointment_confirmed ? t('superadmin.status.yes') : t('superadmin.status.no')} /><Detail label={t('superadmin.preVisits.detail.appointmentDate')} value={formatDateTime(preVisit.appointment_date)} /></div></section>
        <section className={styles.card}><div className={styles.cardHead}><ShieldCheck aria-hidden="true" /><h2>{t('superadmin.preVisits.detail.supervisorSection')}</h2></div><div className={styles.grid}><Detail label={t('superadmin.preVisits.detail.supervisorApproval')} value={preVisit.supervisor_approval ? t('superadmin.status.approved') : t('superadmin.status.notApproved')} /><Detail label={t('superadmin.preVisits.detail.createdAt')} value={formatDateTime(preVisit.created_at)} /></div></section>
        <section className={`${styles.card} ${styles.notesCard}`}><div className={styles.cardHead}><FileText aria-hidden="true" /><h2>{t('superadmin.preVisits.detail.notesSection')}</h2></div><p className={styles.notes}>{preVisit.previsit_notes || t('superadmin.preVisits.detail.noNotes')}</p></section>
      </div>
    </main>
  )
}

function Detail({ label, value, full = false }: { label: string; value: any; full?: boolean }) {
  return <div className={full ? `${styles.detail} ${styles.full}` : styles.detail}><span>{label}</span><strong>{value === null || value === undefined || value === '' ? '-' : String(value)}</strong></div>
}
