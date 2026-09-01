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

export default async function VisitResultPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params

  const decodedCustomerId = decodeURIComponent(customerId)

  const supabase = await createClient()
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, allMessages, key, params)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const email = user.email.trim().toLowerCase()

  const { data: customer } = await supabase
    .from('customers')
    .select(`
      customer_id,
      customer_name,
      phone_number,
      service_address,
      agent_email,
      payment_status,
      visit_status
    `)
    .eq('customer_id', decodedCustomerId)
    .eq('agent_email', email)
    .maybeSingle()

  if (!customer) {
    return (
      <ErrorBlock
        message={t('agent.visitResult.notFound')}
        backHref={`/agent/customers/${encodeURIComponent(decodedCustomerId)}`}
        t={t}
      />
    )
  }

  const { data: visit, error } = await supabase
    .from('visits')
    .select('*')
    .eq('customer_id', decodedCustomerId)
    .eq('agent_email', email)
    .maybeSingle()

  if (error || !visit) {
    return (
      <ErrorBlock
        message={t('agent.visitResult.resultNotFound')}
        backHref={`/agent/customers/${encodeURIComponent(decodedCustomerId)}`}
        t={t}
      />
    )
  }

  let photoUrl: string | null = null

  if (visit.visit_photo_url) {
    const { data } = await supabase.storage
      .from('visit-evidence')
      .createSignedUrl(visit.visit_photo_url, 60 * 10)

    photoUrl = data?.signedUrl ?? null
  }

  function formatDate(value: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('id-ID')
  }

  function formatPaymentDate(value: string | null) {
    if (!value) return '-'
    return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID')
  }

  const backHref = `/agent/customers/${encodeURIComponent(decodedCustomerId)}`
  const area = customer.service_address || '-'

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6 lg:p-8">
      <Link href={backHref} className="dui-btn dui-btn-ghost dui-btn-sm gap-1 px-0 w-fit">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('agent.visitResult.backToDetail')}
      </Link>

      <SuperadminPageHeader
        breadcrumbs={[
          { label: t('agent.visitResult.breadcrumbAgent'), href: '/agent', icon: UserRound },
          { label: t('agent.visitResult.breadcrumbCustomers'), href: '/agent/customers', icon: Building2 },
          { label: t('agent.visitResult.breadcrumbResult'), icon: BadgeCheck },
        ]}
        title={customer.customer_name}
        description={`${customer.customer_id} · ${area}`}
      />

      <div className="dui-alert dui-alert-success">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <div className="font-bold">{t('agent.visitResult.completed')}</div>
          <div className="text-sm opacity-80">
            {visit.visit_status_kunjungan || t('agent.visitResult.recorded')}
          </div>
        </div>
      </div>

      <InfoCard title={t('agent.visitResult.cardInfo')} icon={ClipboardList}>
        <InfoGrid
          t={t}
          items={[
            [t('agent.visitResult.visitId'), visit.visit_id],
            [t('agent.visitResult.visitDate'), formatDate(visit.visit_date)],
            [t('agent.visitResult.visitStatus'), visit.visit_status_kunjungan],
            [t('agent.visitResult.conversation'), visit.conversation_result],
          ]}
        />
      </InfoCard>

      <InfoCard title={t('agent.visitResult.cardLocation')} icon={MapPin}>
        <InfoGrid
          t={t}
          items={[
            [t('agent.visitResult.latitude'), visit.latitude],
            [t('agent.visitResult.longitude'), visit.longitude],
            [
              t('agent.visitResult.gpsAccuracy'),
              visit.gps_accuracy ? t('agent.visitResult.meterUnit', { value: Number(visit.gps_accuracy).toFixed(1) }) : '-',
            ],
            [t('agent.visitResult.gpsTime'), formatDate(visit.gps_captured_at)],
            [
              t('agent.visitResult.distance'),
              visit.distance_to_customer_meters !== null
                ? t('agent.visitResult.meterUnit', { value: Number(visit.distance_to_customer_meters).toFixed(1) })
                : '-',
            ],
            [
              t('agent.visitResult.locationMatch'),
              visit.location_match === true ? t('agent.visitResult.matchYes') : visit.location_match === false ? t('agent.visitResult.matchNo') : t('agent.visitResult.matchNa'),
            ],
            [t('agent.visitResult.visitAddress'), visit.visit_address],
          ]}
        />

        {visit.latitude && visit.longitude && (
          <div className="aspect-video w-full overflow-hidden rounded-box border border-base-300">
            <iframe
              title={t('agent.visitResult.mapTitle')}
              src={`https://maps.google.com/maps?q=${visit.latitude},${visit.longitude}&z=17&output=embed`}
              loading="lazy"
              className="h-full w-full border-0"
            />
          </div>
        )}
      </InfoCard>

      <InfoCard title={t('agent.visitResult.cardPhoto')} icon={Camera}>
        {photoUrl ? (
          <figure className="overflow-hidden rounded-box border border-base-300">
            <img src={photoUrl} alt={t('agent.visitResult.photoAlt')} className="w-full" />
            <figcaption className="flex items-center gap-2 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              {t('agent.visitResult.photoStamped')}
            </figcaption>
          </figure>
        ) : (
          <div className="dui-alert dui-alert-ghost">
            <span>{t('agent.visitResult.photoUnavailable')}</span>
          </div>
        )}
      </InfoCard>

      <InfoCard title={t('agent.visitResult.cardResponse')} icon={Phone}>
        <InfoGrid
          t={t}
          items={[
            [t('agent.visitResult.approvedOffer'), visit.approved_offer],
            [t('agent.visitResult.plannedDate'), formatPaymentDate(visit.planned_payment_date)],
            [t('agent.visitResult.unpaidReason'), visit.unpaid_reason],
            [
              t('agent.visitResult.paymentStatus'),
              customer.payment_status ? customer.payment_status.toUpperCase() : '-',
            ],
            [t('agent.visitResult.updatedPhone'), visit.updated_phone],
            [t('agent.visitResult.consent'), visit.consent_given ? t('agent.visitResult.consentGiven') : t('agent.visitResult.consentNotGiven')],
          ]}
        />
      </InfoCard>

      <InfoCard title={t('agent.visitResult.cardNotes')} icon={Receipt}>
        <p className="text-sm whitespace-pre-wrap text-base-content">
          {visit.additional_notes || t('agent.visitResult.noNotes')}
        </p>
      </InfoCard>
    </div>
  )
}

const CameraIcon = ({ className, 'aria-hidden': ariaHidden }: { className?: string; 'aria-hidden'?: boolean }) => (
  <svg className={className} aria-hidden={ariaHidden} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

function ErrorBlock({ message, backHref, t }: { message: string; backHref: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      <Link href={backHref} className="dui-btn dui-btn-ghost dui-btn-sm mb-4">
        {t('agent.visitResult.back')}
      </Link>
      <div className="dui-alert dui-alert-error" role="alert">
        <span>{message}</span>
      </div>
    </div>
  )
}

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof MapPin
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} className="dui-card border border-base-300 bg-base-100 shadow-sm">
      <div className="dui-card-body">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-base-content">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
          {title}
        </h2>
        <div className="mt-1">{children}</div>
      </div>
    </section>
  )
}

function InfoGrid({ t, items }: { t: (key: string, params?: Record<string, string | number>) => string; items: [string, any][] }) {
  const addressKey = t('agent.visitResult.visitAddress')
  const offerKey = t('agent.visitResult.approvedOffer')
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className={`${label === addressKey || label === offerKey ? 'sm:col-span-2' : ''}`}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
            {label}
          </dt>
          <dd className="mt-1 text-sm font-medium break-words text-base-content">
            {value === null || value === undefined || value === '' ? '-' : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}
