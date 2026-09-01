import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Phone,
  Sparkles,
  Store,
  UserRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

export default async function AgentCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
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

  const { data: agent } = await supabase
    .from('agents')
    .select('role, active')
    .eq('email', email)
    .maybeSingle()

  if (!agent || !agent.active || agent.role !== 'agent') {
    redirect('/auth/route')
  }

  const decodedCustomerId = decodeURIComponent(customerId)

  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('customer_id', decodedCustomerId)
    .eq('agent_email', email)
    .maybeSingle()

  if (error) {
    return <ErrorBlock message={error.message} backHref="/agent/customers" t={t} />
  }

  if (!customer) {
    return (
      <ErrorBlock
        message={t('agent.customer.notFound')}
        backHref="/agent/customers"
        t={t}
      />
    )
  }

  const { data: preVisit } = await supabase
    .from('pre_visits')
    .select('previsit_id, previsit_status')
    .eq('customer_id', decodedCustomerId)
    .eq('agent_email', email)
    .maybeSingle()

  const { data: visit } = await supabase
    .from('visits')
    .select('visit_id, visit_date, visit_status_kunjungan, conversation_result')
    .eq('customer_id', decodedCustomerId)
    .eq('agent_email', email)
    .maybeSingle()

  function formatDate(value: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleDateString('id-ID')
  }

  function formatMoney(value: number | string | null) {
    return `Rp${Number(value ?? 0).toLocaleString('id-ID')}`
  }

  const priority = customer.priority_rank
  const days = customer.days_left_to_churn
  const area = customer.sub_district || customer.district || customer.city || '-'

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: t('agent.customer.breadcrumbAgent'), href: '/agent', icon: UserRound },
          { label: t('agent.customer.breadcrumbCustomers'), href: '/agent/customers', icon: Building2 },
          { label: customer.customer_name },
        ]}
        title={customer.customer_name}
        description={`${customer.customer_id} · ${area}`}
      />

      <section aria-label={t('agent.customer.summaryAria')} className="dui-stats dui-stats-vertical sm:dui-stats-horizontal w-full overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-stat">
          <div className="dui-stat-title">{t('agent.customer.statPriority')}</div>
          <div className={`dui-stat-value ${priority < 3 ? 'text-error' : priority === 3 ? 'text-warning' : ''}`}>
            {priority ?? '-'}
          </div>
          {priority && (
            <div className="dui-stat-desc">
              {priority === 1 ? t('agent.customer.priorityUrgent') : priority === 2 ? t('agent.customer.priorityUrgent2') : priority === 3 ? t('agent.customer.priorityMedium') : t('agent.customer.priorityLow')}
            </div>
          )}
        </div>

        <div className="dui-stat">
          <div className="dui-stat-title">{t('agent.customer.statDaysToChurn')}</div>
          <div className={`dui-stat-value ${days !== null && days <= 7 ? 'text-error' : ''}`}>
            {days ?? '-'}
          </div>
          {days !== null && (
            <div className="dui-stat-desc">
              {days <= 0 ? t('agent.customer.churnOverdue') : days <= 7 ? t('agent.customer.churnUrgent') : t('agent.customer.churnOk')}
            </div>
          )}
        </div>

        <div className="dui-stat">
          <div className="dui-stat-title">{t('agent.customer.statVisitStatus')}</div>
          <div className="dui-stat-value text-2xl">
            {visit ? (
              <CheckCircle2 className="inline-block h-8 w-8 text-success" aria-hidden="true" />
            ) : (
              <MapPin className="inline-block h-8 w-8 text-primary" aria-hidden="true" />
            )}
          </div>
          <div className="dui-stat-desc">
            {visit ? t('agent.customer.visited') : t('agent.customer.notVisited')}
          </div>
        </div>
      </section>

      {visit ? (
        <div className="dui-alert dui-alert-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>
            {t('agent.customer.visitComplete')}
            {visit.visit_date
              ? ` · ${new Date(visit.visit_date).toLocaleString('id-ID')}`
              : ''}
            {visit.visit_status_kunjungan ? ` · ${visit.visit_status_kunjungan}` : ''}
          </span>
        </div>
      ) : (
        <div className="dui-alert dui-alert-info">
          <MapPin className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{t('agent.customer.visitTimeDue')}</span>
        </div>
      )}

      <InfoCard title={t('agent.customer.cardContact')} icon={Phone}>
        <InfoGrid
          t={t}
          items={[
            [t('agent.customer.phoneMain'), customer.phone_number],
            [t('agent.customer.phoneAlt1'), customer.alternative_phone_1],
            [t('agent.customer.phoneAlt2'), customer.alternative_phone_2],
            [t('agent.customer.phoneAlt3'), customer.alternative_phone_3],
            [t('agent.customer.address'), customer.service_address],
          ]}
        />
      </InfoCard>

      <InfoCard title={t('agent.customer.cardLocation')} icon={MapPin}>
        <InfoGrid
          t={t}
          items={[
            [t('agent.customer.region'), customer.region],
            [t('agent.customer.city'), customer.city],
            [t('agent.customer.district'), customer.district],
            [t('agent.customer.subDistrict'), customer.sub_district],
          ]}
        />
      </InfoCard>

      <InfoCard title={t('agent.customer.cardSales')} icon={Store}>
        <InfoGrid
          t={t}
          items={[
            [t('agent.customer.aeName'), customer.ae_name],
            [t('agent.customer.tlName'), customer.tl_name],
            [t('agent.customer.smName'), customer.sm_name],
            [t('agent.customer.salesChannel'), customer.sales_channel],
            [t('agent.customer.billingCycle'), customer.billing_cycle],
          ]}
        />
      </InfoCard>

      <InfoCard title={t('agent.customer.cardBilling')} icon={Building2}>
        <InfoGrid
          t={t}
          items={[
            [t('agent.customer.invoiceDate'), formatDate(customer.invoice_date)],
            [t('agent.customer.dueDate'), formatDate(customer.payment_due_date)],
            [t('agent.customer.suspensionDate'), formatDate(customer.suspension_date)],
            [t('agent.customer.estimatedChurn'), formatDate(customer.estimated_churn_date)],
            [t('agent.customer.invoiceAmount'), formatMoney(customer.invoice_amount)],
            [
              t('agent.customer.paymentStatus'),
              customer.payment_status ? customer.payment_status.toUpperCase() : t('agent.customer.notSet'),
            ],
            [t('agent.customer.tenure'), customer.customer_tenure],
            [t('agent.customer.visitStatus'), customer.visit_status || t('agent.customer.notStarted')],
          ]}
        />
      </InfoCard>

      <InfoCard title={t('agent.customer.cardOffer')} icon={Sparkles}>
        <InfoGrid
          t={t}
          items={[
            [t('agent.customer.recommendedOffer'), customer.recommended_offer],
            [t('agent.customer.maximumOffer'), customer.maximum_offer],
          ]}
        />
      </InfoCard>

      <section aria-label={t('agent.customer.actionsAria')} className="dui-card border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-card-body">
          {visit ? (
            <Link
              href={`/agent/customers/${encodeURIComponent(customer.customer_id)}/visit-result`}
              className="dui-btn dui-btn-primary w-full"
            >
              <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              {t('agent.customer.viewVisitResult')}
            </Link>
          ) : !preVisit ? (
            <Link
              href={`/agent/customers/${encodeURIComponent(customer.customer_id)}/pre-visit`}
              className="dui-btn dui-btn-primary w-full"
            >
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
              {t('agent.customer.startPreVisit')}
            </Link>
          ) : preVisit.previsit_status !== 'Ready for Visit' ? (
            <Link
              href={`/agent/customers/${encodeURIComponent(customer.customer_id)}/pre-visit`}
              className="dui-btn dui-btn-secondary w-full"
            >
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
              {t('agent.customer.continuePreVisit')}
            </Link>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-box bg-success/10 px-4 py-3 text-sm font-semibold text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                {t('agent.customer.preVisitReady')}
              </div>
              <Link
                href={`/agent/customers/${encodeURIComponent(customer.customer_id)}/visit`}
                className="dui-btn dui-btn-primary w-full"
              >
                <MapPin className="h-5 w-5" aria-hidden="true" />
                {t('agent.customer.startVisit')}
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function ErrorBlock({ message, backHref, t }: { message: string; backHref: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      <Link href={backHref} className="dui-btn dui-btn-ghost dui-btn-sm mb-4">
        {t('agent.customer.back')}
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
  const addressKey = t('agent.customer.address')
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className={`${label === addressKey ? 'sm:col-span-2' : ''}`}>
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
