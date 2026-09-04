import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Phone,
  Receipt,
  UserRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

export default async function VisitResultPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params
  const decodedCustomerId = decodeURIComponent(customerId)
  const supabase = await createClient()
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, allMessages, key, params)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const email = user.email.trim().toLowerCase()

  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id,customer_name,phone_number,service_address,agent_email,payment_status,visit_status')
    .eq('customer_id', decodedCustomerId)
    .eq('agent_email', email)
    .maybeSingle()

  if (!customer) return <ErrorBlock message={t('agent.visitResult.notFound')} backHref={`/agent/customers/${encodeURIComponent(decodedCustomerId)}`} t={t} />

  const { data: visit, error } = await supabase
    .from('visits')
    .select('*')
    .eq('customer_id', decodedCustomerId)
    .eq('agent_email', email)
    .maybeSingle()

  if (error || !visit) return <ErrorBlock message={t('agent.visitResult.resultNotFound')} backHref={`/agent/customers/${encodeURIComponent(decodedCustomerId)}`} t={t} />

  let photoUrl: string | null = null
  if (visit.visit_photo_url) {
    const { data } = await supabase.storage.from('visit-evidence').createSignedUrl(visit.visit_photo_url, 60 * 10)
    photoUrl = data?.signedUrl ?? null
  }

  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('id-ID') : '-'
  const formatPaymentDate = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID') : '-'
  const backHref = `/agent/customers/${encodeURIComponent(decodedCustomerId)}`
  const locationMatch = visit.location_match === true ? t('agent.visitResult.matchYes') : visit.location_match === false ? t('agent.visitResult.matchNo') : t('agent.visitResult.matchNa')

  return (
    <main className={styles.page}>
      <Link href={backHref} className={styles.backLink}><ArrowLeft size={15} /> {t('agent.visitResult.backToDetail')}</Link>

      <SuperadminPageHeader
        breadcrumbs={[
          { label: t('agent.visitResult.breadcrumbAgent'), href: '/agent', icon: UserRound },
          { label: t('agent.visitResult.breadcrumbCustomers'), href: '/agent/customers', icon: Building2 },
          { label: t('agent.visitResult.breadcrumbResult'), icon: BadgeCheck },
        ]}
        title={t('agent.visitResult.breadcrumbResult')}
        description={`${customer.customer_id} · ${customer.customer_name}`}
      />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{t('agent.visitResult.completed')}</span>
          <h1>{customer.customer_name}</h1>
          <p>{customer.service_address || customer.customer_id}</p>
        </div>
        <div className={styles.status}><CheckCircle2 size={16} /> {visit.visit_status_kunjungan || t('agent.visitResult.recorded')}</div>
      </section>

      <section className={styles.summaryGrid}>
        <div className={`${styles.summaryCard} ${styles.tonePurple}`}><ClipboardList /><div><span>{t('agent.visitResult.visitId')}</span><strong>{visit.visit_id}</strong></div></div>
        <div className={`${styles.summaryCard} ${styles.toneGreen}`}><MapPin /><div><span>{t('agent.visitResult.locationMatch')}</span><strong>{locationMatch}</strong></div></div>
        <div className={`${styles.summaryCard} ${styles.toneBlue}`}><Phone /><div><span>{t('agent.visitResult.paymentStatus')}</span><strong>{customer.payment_status ? customer.payment_status.toUpperCase() : '-'}</strong></div></div>
      </section>

      <div className={styles.contentGrid}>
        <InfoCard title={t('agent.visitResult.cardInfo')} icon={ClipboardList}>
          <InfoGrid items={[
            [t('agent.visitResult.visitDate'), formatDate(visit.visit_date)],
            [t('agent.visitResult.visitStatus'), visit.visit_status_kunjungan],
            [t('agent.visitResult.conversation'), visit.conversation_result],
            [t('agent.visitResult.consent'), visit.consent_given ? t('agent.visitResult.consentGiven') : t('agent.visitResult.consentNotGiven')],
          ]} />
        </InfoCard>

        <InfoCard title={t('agent.visitResult.cardResponse')} icon={Phone}>
          <InfoGrid items={[
            [t('agent.visitResult.approvedOffer'), visit.approved_offer, true],
            [t('agent.visitResult.plannedDate'), formatPaymentDate(visit.planned_payment_date)],
            [t('agent.visitResult.unpaidReason'), visit.unpaid_reason],
            [t('agent.visitResult.updatedPhone'), visit.updated_phone],
          ]} />
        </InfoCard>
      </div>

      <InfoCard title={t('agent.visitResult.cardLocation')} icon={MapPin}>
        <InfoGrid items={[
          [t('agent.visitResult.latitude'), visit.latitude],
          [t('agent.visitResult.longitude'), visit.longitude],
          [t('agent.visitResult.gpsAccuracy'), visit.gps_accuracy ? t('agent.visitResult.meterUnit', { value: Number(visit.gps_accuracy).toFixed(1) }) : '-'],
          [t('agent.visitResult.gpsTime'), formatDate(visit.gps_captured_at)],
          [t('agent.visitResult.distance'), visit.distance_to_customer_meters !== null ? t('agent.visitResult.meterUnit', { value: Number(visit.distance_to_customer_meters).toFixed(1) }) : '-'],
          [t('agent.visitResult.locationMatch'), locationMatch],
          [t('agent.visitResult.visitAddress'), visit.visit_address, true],
        ]} />
        {visit.latitude && visit.longitude && <div className={styles.map}><iframe title={t('agent.visitResult.mapTitle')} src={`https://maps.google.com/maps?q=${visit.latitude},${visit.longitude}&z=17&output=embed`} loading="lazy" /></div>}
      </InfoCard>

      <section className={styles.photoCard}>
        <div className={styles.cardTitle}><Camera /><h2>{t('agent.visitResult.cardPhoto')}</h2></div>
        {photoUrl ? <figure className={styles.photoFigure}><img src={photoUrl} alt={t('agent.visitResult.photoAlt')} /><figcaption className={styles.photoCaption}><BadgeCheck size={16} /> {t('agent.visitResult.photoStamped')}</figcaption></figure> : <div className={styles.emptyPhoto}>{t('agent.visitResult.photoUnavailable')}</div>}
      </section>

      <section className={styles.notesCard}>
        <div className={styles.cardTitle}><Receipt /><h2>{t('agent.visitResult.cardNotes')}</h2></div>
        <p className={styles.notesText}>{visit.additional_notes || t('agent.visitResult.noNotes')}</p>
      </section>
    </main>
  )
}

function ErrorBlock({ message, backHref, t }: { message: string; backHref: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  return <main className={styles.page}><Link href={backHref} className={styles.backLink}>{t('agent.visitResult.back')}</Link><div className={styles.errorCard} role="alert">{message}</div></main>
}

function InfoCard({ title, icon: Icon, children }: { title: string; icon: typeof MapPin; children: React.ReactNode }) {
  return <section className={styles.card} aria-label={title}><div className={styles.cardTitle}><Icon /><h2>{title}</h2></div>{children}</section>
}

function InfoGrid({ items }: { items: [string, any, boolean?][] }) {
  return <dl className={styles.infoGrid}>{items.map(([label, value, wide]) => <div key={label} className={`${styles.infoItem} ${wide ? styles.infoItemWide : ''}`}><dt>{label}</dt><dd>{value === null || value === undefined || value === '' ? '-' : String(value)}</dd></div>)}</dl>
}
