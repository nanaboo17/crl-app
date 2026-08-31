'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function AssignCustomerPage() {
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
        setError('Customer not found.')
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

    router.push('/admin/customers')
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
        <p>Loading customer...</p>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="mobile-page">
        <p>{error || 'Customer not found.'}</p>
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
        ← Back
      </button>

      <p className="eyebrow">ADMIN</p>
      <h1>Assign Customer</h1>

      <div className="customer-detail-card">
        <div className="customer-detail-header">
          <div>
            <small>Customer</small>
            <h2>{customer.customer_name}</h2>
            <p>{customer.customer_id}</p>
          </div>

          <span className="priority-badge">
            Priority {customer.priority_rank ?? '-'}
          </span>
        </div>
      </div>

      <section className="card detail-section">
        <h3>Customer Information</h3>

        <div className="detail-grid">
          <DetailItem
            label="Main Phone Number"
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

      <section className="card detail-section">
        <h3>Location</h3>

        <div className="detail-grid">
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

      <section className="card detail-section">
        <h3>Sales Information</h3>

        <div className="detail-grid">
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

      <section className="card detail-section">
        <h3>Billing Information</h3>

        <div className="detail-grid">
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
            label="Days Left to Churn"
            value={customer.days_left_to_churn}
          />

          <DetailItem
            label="Invoice Amount"
            value={formatMoney(customer.invoice_amount)}
          />

          <DetailItem
            label="Payment Status"
            value={customer.payment_status || 'Not Set'}
          />

          <DetailItem
            label="Customer Tenure"
            value={customer.customer_tenure}
          />
        </div>
      </section>

      <section className="card detail-section">
        <h3>Offer</h3>

        <div className="detail-grid">
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

      <section className="card detail-section">
        <h3>Visit Information</h3>

        <div className="detail-grid">
          <DetailItem
            label="Visit Status"
            value={customer.visit_status || 'Not Started'}
          />

          <DetailItem
            label="Customer Status"
            value={customer.customer_status}
          />
        </div>
      </section>

      <section className="card assignment-section">
        <h3>Agent Assignment</h3>

        <label>
          Assigned Agent

          <select
            value={agentEmail}
            onChange={(e) => setAgentEmail(e.target.value)}
          >
            <option value="">Not Assigned</option>

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
            ? 'Saving...'
            : 'Save Assignment'}
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