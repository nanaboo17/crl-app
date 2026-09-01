'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'

function statusKey(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.toLowerCase()
  if (v === 'paid') return 'superadmin.status.paid'
  if (v === 'unpaid') return 'superadmin.status.unpaid'
  if (v === 'not set') return 'superadmin.status.notSet'
  if (v === 'not started') return 'superadmin.status.notStarted'
  if (v === 'ready for visit') return 'superadmin.status.readyForVisit'
  if (v === '1. assigned') return 'superadmin.status.assigned'
  if (v === 'unassigned') return 'superadmin.status.unassigned'
  return null
}

export default function AssignCustomerPage() {
  const { locale, setLocale, t } = useI18n()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const customerId = decodeURIComponent(params.customerId as string)

  const [customer, setCustomer] = useState<any>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [agentEmail, setAgentEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const { data: customerData, error: customerError } =
        await supabase
          .from('customers')
          .select('*')
          .eq('customer_id', customerId)
          .maybeSingle()

      if (customerError) {
        setError(customerError.message)
        setLoading(false)
        return
      }

      if (!customerData) {
        setError(t('superadmin.customerDetail.notFound'))
        setLoading(false)
        return
      }

      const { data: agentData, error: agentError } =
        await supabase
          .from('agents')
          .select('email, agent_name, sales_code')
          .eq('role', 'agent')
          .eq('active', true)
          .order('agent_name')

      if (agentError) {
        setError(agentError.message)
        setLoading(false)
        return
      }

      setCustomer(customerData)
      setAgentEmail(customerData.agent_email ?? '')
      setAgents(agentData ?? [])
      setLoading(false)
    }

    loadData()
  }, [customerId])

  async function saveAssignment() {
    setSaving(true)
    setError('')

    const { error } = await supabase
      .from('customers')
      .update({
        agent_email: agentEmail || null,
        customer_status: agentEmail
          ? '1. Assigned'
          : 'Unassigned',
      })
      .eq('customer_id', customerId)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    router.push('/superadmin/customers')
    router.refresh()
  }

  function formatDate(value: string | null) {
    if (!value) return '-'

    return new Date(value).toLocaleDateString('en-GB')
  }

  function formatMoney(value: number | string | null) {
    return `Rp${Number(value ?? 0).toLocaleString('id-ID')}`
  }

  if (loading) {
    return (
      <main className="mobile-page">
        <p>{t('superadmin.customerDetail.loading')}</p>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="mobile-page">
        <p>{error || t('superadmin.customerDetail.notFound')}</p>
      </main>
    )
  }

  return (
    <main className="mobile-page">
      <button
        type="button"
        className="back-button"
        onClick={() => router.push('/admin/customers')}
      >
        {t('superadmin.customerDetail.back')}
      </button>

      <p className="eyebrow">{t('superadmin.customerDetail.eyebrow')}</p>
      <h1>{t('superadmin.customerDetail.assignTitle')}</h1>

      <div className="customer-detail-card">
        <div className="customer-detail-header">
          <div>
            <small>{t('superadmin.customerDetail.customerLabel')}</small>
            <h2>{customer.customer_name}</h2>
            <p>{customer.customer_id}</p>
          </div>

          <span className="priority-badge">
            {t('superadmin.customerDetail.priority', { rank: customer.priority_rank ?? '-' })}
          </span>
        </div>
      </div>

      <section className="card detail-section">
        <h3>{t('superadmin.customerDetail.customerInfo')}</h3>

        <div className="detail-grid">
          <DetailItem
            label={t('superadmin.customerDetail.mainPhone')}
            value={customer.phone_number}
          />

          <DetailItem
            label={t('superadmin.customerDetail.altPhone1')}
            value={customer.alternative_phone_1}
          />

          <DetailItem
            label={t('superadmin.customerDetail.altPhone2')}
            value={customer.alternative_phone_2}
          />

          <DetailItem
            label={t('superadmin.customerDetail.altPhone3')}
            value={customer.alternative_phone_3}
          />

          <DetailItem
            label={t('superadmin.customerDetail.address')}
            value={customer.service_address}
            full
          />
        </div>
      </section>

      <section className="card detail-section">
        <h3>{t('superadmin.customerDetail.location')}</h3>

        <div className="detail-grid">
          <DetailItem
            label={t('superadmin.customerDetail.region')}
            value={customer.region}
          />

          <DetailItem
            label={t('superadmin.customerDetail.city')}
            value={customer.city}
          />

          <DetailItem
            label={t('superadmin.customerDetail.district')}
            value={customer.district}
          />

          <DetailItem
            label={t('superadmin.customerDetail.subDistrict')}
            value={customer.sub_district}
          />
        </div>
      </section>

      <section className="card detail-section">
        <h3>{t('superadmin.customerDetail.salesInfo')}</h3>

        <div className="detail-grid">
          <DetailItem
            label={t('superadmin.customerDetail.aeName')}
            value={customer.ae_name}
          />

          <DetailItem
            label={t('superadmin.customerDetail.tlName')}
            value={customer.tl_name}
          />

          <DetailItem
            label={t('superadmin.customerDetail.smName')}
            value={customer.sm_name}
          />

          <DetailItem
            label={t('superadmin.customerDetail.salesChannel')}
            value={customer.sales_channel}
          />

          <DetailItem
            label={t('superadmin.customerDetail.billingCycle')}
            value={customer.billing_cycle}
          />
        </div>
      </section>

      <section className="card detail-section">
        <h3>{t('superadmin.customerDetail.billingInfo')}</h3>

        <div className="detail-grid">
          <DetailItem
            label={t('superadmin.customerDetail.invoiceDate')}
            value={formatDate(customer.invoice_date)}
          />

          <DetailItem
            label={t('superadmin.customerDetail.paymentDueDate')}
            value={formatDate(customer.payment_due_date)}
          />

          <DetailItem
            label={t('superadmin.customerDetail.suspensionDate')}
            value={formatDate(customer.suspension_date)}
          />

          <DetailItem
            label={t('superadmin.customerDetail.estimatedChurnDate')}
            value={formatDate(customer.estimated_churn_date)}
          />

          <DetailItem
            label={t('superadmin.customerDetail.daysLeftToChurn')}
            value={customer.days_left_to_churn}
          />

          <DetailItem
            label={t('superadmin.customerDetail.invoiceAmount')}
            value={formatMoney(customer.invoice_amount)}
          />

          <DetailItem
            label={t('superadmin.customerDetail.paymentStatus')}
            value={
              statusKey(customer.payment_status)
                ? t(statusKey(customer.payment_status)!)
                : customer.payment_status || t('superadmin.status.notSet')
            }
          />

          <DetailItem
            label={t('superadmin.customerDetail.customerTenure')}
            value={customer.customer_tenure}
          />
        </div>
      </section>

      <section className="card detail-section">
        <h3>{t('superadmin.customerDetail.offer')}</h3>

        <div className="detail-grid">
          <DetailItem
            label={t('superadmin.customerDetail.recommendedOffer')}
            value={customer.recommended_offer}
            full
          />

          <DetailItem
            label={t('superadmin.customerDetail.maximumOffer')}
            value={customer.maximum_offer}
            full
          />
        </div>
      </section>

      <section className="card detail-section">
        <h3>{t('superadmin.customerDetail.visitInfo')}</h3>

        <div className="detail-grid">
          <DetailItem
            label={t('superadmin.customerDetail.visitStatus')}
            value={
              statusKey(customer.visit_status)
                ? t(statusKey(customer.visit_status)!)
                : customer.visit_status || t('superadmin.status.notStarted')
            }
          />

          <DetailItem
            label={t('superadmin.customerDetail.customerStatus')}
            value={
              statusKey(customer.customer_status)
                ? t(statusKey(customer.customer_status)!)
                : customer.customer_status
            }
          />
        </div>
      </section>

      <section className="card assignment-section">
        <h3>{t('superadmin.customerDetail.agentAssignment')}</h3>

        <label>
          {t('superadmin.customerDetail.assignedAgent')}

          <select
            value={agentEmail}
            onChange={(e) => setAgentEmail(e.target.value)}
          >
            <option value="">{t('superadmin.customerDetail.notAssignedOption')}</option>

            {agents.map((agent) => (
              <option
                key={agent.email}
                value={agent.email}
              >
                {agent.agent_name}
                {agent.sales_code
                  ? ` - ${agent.sales_code}`
                  : ''}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="form-error">
            {error}
          </p>
        )}

        <button
          type="button"
          className="primary-button"
          onClick={saveAssignment}
          disabled={saving}
        >
          {saving
            ? t('superadmin.customerDetail.saving')
            : t('superadmin.customerDetail.saveAssignment')}
        </button>
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
    <div className={full ? 'detail-item detail-full' : 'detail-item'}>
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