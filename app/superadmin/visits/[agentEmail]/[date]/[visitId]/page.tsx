import { redirect } from 'next/navigation'
import { Camera, MapPin, Navigation, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import styles from './page.module.css'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

export default async function SuperadminVisitDetailPage({
  params,
}: {
  params: Promise<{ agentEmail: string; date: string; visitId: string }>
}) {
  const { agentEmail, date, visitId } = await params
  const decodedEmail = decodeURIComponent(agentEmail)
  const decodedVisitId = decodeURIComponent(visitId)

  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) =>
    translate(locale, allMessages, key, values)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const currentEmail = user.email.trim().toLowerCase()
  const { data: currentUser } = await supabase
    .from('agents')
    .select('role, active')
    .eq('email', currentEmail)
    .maybeSingle()

  if (!currentUser || !currentUser.active || currentUser.role !== 'superadmin') {
    redirect('/auth/route')
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('email, agent_name, sales_code')
    .eq('email', decodedEmail)
    .maybeSingle()

  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .select('*')
    .eq('visit_id', decodedVisitId)
    .eq('agent_email', decodedEmail)
    .maybeSingle()

  const dateHref = `/superadmin/visits/${encodeURIComponent(decodedEmail)}/${date}`

  if (visitError || !visit) {
    return (
      <main className={styles.page}>
        <SuperadminPageHeader
          breadcrumbs={[
            { label: 'Superadmin', href: '/superadmin' },
            { label: tx('Visits', 'Kunjungan'), href: '/superadmin/visits', icon: MapPin },
            { label: agent?.agent_name || decodedEmail, href: `/superadmin/visits/${encodeURIComponent(decodedEmail)}` },
            { label: date, href: dateHref },
            { label: decodedVisitId },
          ]}
          title={tx('Visit Detail', 'Detail Kunjungan')}
          description={decodedVisitId}
        />
        <div className={styles.errorCard}>{t('superadmin.visits.detail.notFound')}</div>
      </main>
    )
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id,customer_name,phone_number,service_address,city,district,sub_district,given_latitude,given_longitude,payment_status,visit_status')
    .eq('customer_id', visit.customer_id)
    .maybeSingle()

  let photoUrl: string | null = null
  if (visit.visit_photo_url) {
    const { data } = await supabase.storage.from('visit-evidence').createSignedUrl(visit.visit_photo_url, 60 * 10)
    photoUrl = data?.signedUrl ?? null
  }

  function formatDateTime(value: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
  }

  function formatDate(value: string | null) {
    if (!value) return '-'
    return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID')
  }

  const distance = visit.distance_to_customer_meters !== null
    ? `${Number(visit.distance_to_customer_meters).toFixed(1)} m`
    : '-'
  const locationStatus = visit.location_match === true
    ? t('superadmin.status.match')
    : visit.location_match === false
      ? t('superadmin.status.outsideRange')
      : t('superadmin.status.notAvailable')

  return (
    <main className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: tx('Visits', 'Kunjungan'), href: '/superadmin/visits', icon: MapPin },
          { label: agent?.agent_name || decodedEmail, href: `/superadmin/visits/${encodeURIComponent(decodedEmail)}` },
          { label: date, href: dateHref },
          { label: decodedVisitId },
        ]}
        title={customer?.customer_name || visit.customer_id}
        description={`${decodedVisitId} · ${visit.customer_id}`}
      />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{tx('FIELD VISIT RECORD', 'REKAMAN KUNJUNGAN LAPANGAN')}</span>
          <h1>{tx('One visit, fully traceable.', 'Satu kunjungan, tercatat lengkap.')}</h1>
          <p>{tx(
            'Review the visit outcome, customer context, GPS verification, evidence photo, and notes in one place.',
            'Tinjau hasil kunjungan, konteks pelanggan, verifikasi GPS, foto bukti, dan catatan dalam satu halaman.'
          )}</p>
        </div>
        <div className={styles.heroScene} aria-hidden="true">
          <div className={styles.heroPin}><MapPin /></div>
          <div className={styles.heroRoute} />
          <div className={styles.heroDotOne} />
          <div className={styles.heroDotTwo} />
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <SummaryCard icon={MapPin} label={t('superadmin.visits.detail.visitStatus')} value={visit.visit_status_kunjungan || '-'} tone="purple" />
        <SummaryCard icon={UserRound} label={t('superadmin.visits.detail.payment')} value={customer?.payment_status ? customer.payment_status.toUpperCase() : '-'} tone="green" />
        <SummaryCard icon={Navigation} label={t('superadmin.visits.detail.locationResult')} value={locationStatus} tone={visit.location_match === false ? 'pink' : 'blue'} />
        <SummaryCard icon={Camera} label={t('superadmin.visits.detail.distance')} value={distance} tone="yellow" />
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.card}>
          <SectionTitle>{t('superadmin.visits.detail.agentSection')}</SectionTitle>
          <div className={styles.grid}>
            <Detail label={t('superadmin.visits.detail.agentName')} value={agent?.agent_name} />
            <Detail label={t('superadmin.visits.detail.salesCode')} value={agent?.sales_code} />
            <Detail label={t('superadmin.visits.detail.agentEmail')} value={decodedEmail} full />
          </div>
        </div>

        <div className={styles.card}>
          <SectionTitle>{t('superadmin.visits.detail.customerSection')}</SectionTitle>
          <div className={styles.grid}>
            <Detail label={t('superadmin.visits.detail.customerId')} value={customer?.customer_id} />
            <Detail label={t('superadmin.visits.detail.customerName')} value={customer?.customer_name} />
            <Detail label={t('superadmin.visits.detail.phone')} value={customer?.phone_number} />
            <Detail label={t('superadmin.visits.detail.updatedPhone')} value={visit.updated_phone} />
            <Detail label={t('superadmin.visits.detail.area')} value={customer?.sub_district || customer?.district || customer?.city} />
            <Detail label={t('superadmin.visits.detail.customerAddress')} value={customer?.service_address} full />
          </div>
        </div>

        <div className={`${styles.card} ${styles.fullWidthCard}`}>
          <SectionTitle>{t('superadmin.visits.detail.visitResult')}</SectionTitle>
          <div className={styles.gridWide}>
            <Detail label={t('superadmin.visits.detail.visitDate')} value={formatDateTime(visit.visit_date)} />
            <Detail label={t('superadmin.visits.detail.visitStatusKunjungan')} value={visit.visit_status_kunjungan} />
            <Detail label={t('superadmin.visits.detail.promiseToPayDate')} value={formatDate(visit.planned_payment_date)} />
            <Detail label={t('superadmin.visits.detail.consent')} value={visit.consent_given ? t('superadmin.status.given') : t('superadmin.status.notGiven')} />
            <Detail label={t('superadmin.visits.detail.visitStatusCustomer')} value={customer?.visit_status} />
            <Detail label={t('superadmin.visits.detail.unpaidReason')} value={visit.unpaid_reason} />
            <Detail label={t('superadmin.visits.detail.conversationResult')} value={visit.conversation_result} full />
            <Detail label={t('superadmin.visits.detail.approvedOffer')} value={visit.approved_offer} full />
          </div>
        </div>

        <div className={`${styles.card} ${styles.fullWidthCard}`}>
          <SectionTitle>{t('superadmin.visits.detail.gpsVerification')}</SectionTitle>
          <div className={styles.gridWide}>
            <Detail label={t('superadmin.visits.detail.givenLatitude')} value={customer?.given_latitude} />
            <Detail label={t('superadmin.visits.detail.givenLongitude')} value={customer?.given_longitude} />
            <Detail label={t('superadmin.visits.detail.visitLatitude')} value={visit.latitude} />
            <Detail label={t('superadmin.visits.detail.visitLongitude')} value={visit.longitude} />
            <Detail label={t('superadmin.visits.detail.accuracy')} value={visit.gps_accuracy !== null ? `${Number(visit.gps_accuracy).toFixed(1)} meters` : '-'} />
            <Detail label={t('superadmin.visits.detail.capturedAt')} value={formatDateTime(visit.gps_captured_at)} />
            <Detail label={t('superadmin.visits.detail.distance')} value={distance} />
            <Detail label={t('superadmin.visits.detail.locationResult')} value={locationStatus} />
          </div>
          {visit.latitude && visit.longitude && (
            <div className={styles.mapBox}>
              <iframe
                title={t('superadmin.visits.detail.visitPinpoint')}
                src={`https://maps.google.com/maps?q=${visit.latitude},${visit.longitude}&z=17&output=embed`}
                loading="lazy"
              />
            </div>
          )}
        </div>

        <div className={styles.card}>
          <SectionTitle>{t('superadmin.visits.detail.visitPhoto')}</SectionTitle>
          {photoUrl ? (
            <img src={photoUrl} alt={t('superadmin.visits.detail.visitEvidence')} className={styles.photo} />
          ) : (
            <div className={styles.noPhoto}>{t('superadmin.visits.detail.photoUnavailable')}</div>
          )}
        </div>

        <div className={styles.card}>
          <SectionTitle>{t('superadmin.visits.detail.additionalNotes')}</SectionTitle>
          <p className={styles.notes}>{visit.additional_notes || t('superadmin.visits.detail.noNotes')}</p>
        </div>
      </section>
    </main>
  )
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof MapPin; label: string; value: string; tone: string }) {
  return (
    <article className={`${styles.summaryCard} ${styles[`tone_${tone}`]}`}>
      <div className={styles.summaryIcon}><Icon aria-hidden="true" /></div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className={styles.sectionTitle}>{children}</h2>
}

function Detail({ label, value, full = false }: { label: string; value: any; full?: boolean }) {
  return (
    <div className={full ? `${styles.detail} ${styles.full}` : styles.detail}>
      <span>{label}</span>
      <strong>{value === null || value === undefined || value === '' ? '-' : String(value)}</strong>
    </div>
  )
}
