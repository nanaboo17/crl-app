import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'

export default async function AgentCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const supabase = await createClient()
  

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
    return (
      <main className={styles.page}>
        <div className={styles.errorCard}>
          {error.message}
        </div>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className={styles.page}>
        <Link
          href="/agent/customers"
          className={styles.backButton}
        >
          ← Back
        </Link>

        <div className={styles.errorCard}>
          Customer not found or not assigned to you.
        </div>
      </main>
    )
  }
  

  const { data: preVisit } = await supabase
  .from('pre_visits')
  .select(`
    previsit_id,
    previsit_status
  `)
  .eq('customer_id', decodedCustomerId)
  .eq('agent_email', email)
  .maybeSingle()

  const { data: visit } = await supabase
  .from('visits')
  .select(`
    visit_id,
    visit_date,
    visit_status_kunjungan,
    conversation_result
  `)
  .eq('customer_id', decodedCustomerId)
  .eq('agent_email', email)
  .maybeSingle()

  function formatDate(value: string | null) {
    if (!value) return '-'

    return new Date(value).toLocaleDateString('en-GB')
  }

  function formatMoney(value: number | string | null) {
    return `Rp${Number(value ?? 0).toLocaleString('id-ID')}`
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href="/agent/customers"
          className={styles.backButton}
        >
          ← Back
        </Link>

        <div>
          <p className={styles.eyebrow}>
            CUSTOMER DETAIL
          </p>

          <h1>{customer.customer_name}</h1>

          <p className={styles.customerId}>
            {customer.customer_id}
          </p>
        </div>
      </header>

      <section className={styles.heroCard}>
        <div>
          <span className={styles.label}>
            Priority
          </span>

          <strong className={styles.bigValue}>
            {customer.priority_rank ?? '-'}
          </strong>
        </div>

        <div>
          <span className={styles.label}>
            Days Left to Churn
          </span>

          <strong className={styles.bigValue}>
            {customer.days_left_to_churn ?? '-'}
          </strong>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Contact</h2>

        <div className={styles.grid}>
          <DetailItem
            label="Main Phone"
            value={customer.phone_number}
          />

          <DetailItem
            label="Alternative Phone 1"
            value={customer.alternative_phone_1}
          />

          <DetailItem
            label="Alternative Phone 2"
            value={customer.alternative_phone_2}
          />

          <DetailItem
            label="Alternative Phone 3"
            value={customer.alternative_phone_3}
          />

          <DetailItem
            label="Customer Address"
            value={customer.service_address}
            full
          />
        </div>
      </section>

      <section className={styles.card}>
        <h2>Location</h2>

        <div className={styles.grid}>
          <DetailItem
            label="Region"
            value={customer.region}
          />

          <DetailItem
            label="City"
            value={customer.city}
          />

          <DetailItem
            label="District"
            value={customer.district}
          />

          <DetailItem
            label="Sub-District"
            value={customer.sub_district}
          />
        </div>
      </section>

      <section className={styles.card}>
        <h2>Sales Information</h2>

        <div className={styles.grid}>
          <DetailItem
            label="AE Name"
            value={customer.ae_name}
          />

          <DetailItem
            label="TL Name"
            value={customer.tl_name}
          />

          <DetailItem
            label="SM Name"
            value={customer.sm_name}
          />

          <DetailItem
            label="Sales Channel"
            value={customer.sales_channel}
          />

          <DetailItem
            label="Billing Cycle"
            value={customer.billing_cycle}
          />
        </div>
      </section>

      <section className={styles.card}>
        <h2>Billing</h2>

        <div className={styles.grid}>
          <DetailItem
            label="Invoice Date"
            value={formatDate(customer.invoice_date)}
          />

          <DetailItem
            label="Payment Due Date"
            value={formatDate(customer.payment_due_date)}
          />

          <DetailItem
            label="Suspension Date"
            value={formatDate(customer.suspension_date)}
          />

          <DetailItem
            label="Estimated Churn Date"
            value={formatDate(customer.estimated_churn_date)}
          />

          <DetailItem
            label="Invoice Amount"
            value={formatMoney(customer.invoice_amount)}
          />

          <DetailItem
            label="Payment Status"
            value={
              customer.payment_status
                ? customer.payment_status.toUpperCase()
                : 'Not Set'
            }
          />

          <DetailItem
            label="Customer Tenure"
            value={customer.customer_tenure}
          />

          <DetailItem
            label="Visit Status"
            value={customer.visit_status || 'Not Started'}
          />
        </div>
      </section>

      <section className={styles.card}>
        <h2>Offer</h2>

        <div className={styles.grid}>
          <DetailItem
            label="Recommended Offer"
            value={customer.recommended_offer}
            full
          />

          <DetailItem
            label="Maximum Offer"
            value={customer.maximum_offer}
            full
          />
        </div>
      </section>

      <section className={styles.actionSection}>
  {visit ? (
  <>
    <div className={styles.visitedCard}>
      <div>
        <span>Visit Status</span>
        <strong>✓ Visited</strong>
      </div>

      {visit.visit_status_kunjungan && (
        <p>{visit.visit_status_kunjungan}</p>
      )}

      {visit.conversation_result && (
        <p>{visit.conversation_result}</p>
      )}

      {visit.visit_date && (
        <small>
          {new Date(
            visit.visit_date
          ).toLocaleString('id-ID')}
        </small>
      )}
    </div>

    <Link
      href={`/agent/customers/${encodeURIComponent(
        customer.customer_id
      )}/visit-result`}
      className={styles.viewVisitButton}
    >
      View Visit Result
    </Link>
  </>
) : !preVisit ? (
    <Link
      href={`/agent/customers/${encodeURIComponent(
        customer.customer_id
      )}/pre-visit`}
      className={styles.primaryButton}
    >
      Start Pre-Visit
    </Link>
  ) : preVisit.previsit_status !== 'Ready for Visit' ? (
    <Link
      href={`/agent/customers/${encodeURIComponent(
        customer.customer_id
      )}/pre-visit`}
      className={styles.secondaryButton}
    >
      Continue Pre-Visit
    </Link>
  ) : (
    <>
      <div className={styles.readyCard}>
        <span>Pre-Visit Status</span>
        <strong>Ready for Visit</strong>
      </div>

      <Link
        href={`/agent/customers/${encodeURIComponent(
          customer.customer_id
        )}/visit`}
        className={styles.primaryButton}
      >
        Start Visit
      </Link>
    </>
  )}
</section>

    </main>
  )
}

function DetailItem({
  label,
  value,
  full = false,
}: {
  label: string
  value: any
  full?: boolean
}) {
  return (
    <div
      className={
        full
          ? `${styles.detailItem} ${styles.full}`
          : styles.detailItem
      }
    >
      <span>{label}</span>

      <strong>
        {value === null ||
        value === undefined ||
        value === ''
          ? '-'
          : String(value)}
      </strong>
    </div>
  )
}