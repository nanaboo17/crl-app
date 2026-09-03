'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import styles from './page.module.css'

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
  const { t } = useI18n()
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

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle()

      if (customerError || !customerData) {
        setError(customerError?.message || t('superadmin.customerDetail.notFound'))
        setLoading(false)
        return
      }

      const { data: agentData, error: agentError } = await supabase
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

    void loadData()
  }, [customerId])

  async function saveAssignment() {
    setSaving(true)
    setError('')

    const { error: saveError } = await supabase
      .from('customers')
      .update({ agent_email: agentEmail || null, customer_status: agentEmail ? '1. Assigned' : 'Unassigned' })
      .eq('customer_id', customerId)

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    router.push('/superadmin/customers')
    router.refresh()
  }

  const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('en-GB') : '-'
  const formatMoney = (value: number | string | null) => `Rp${Number(value ?? 0).toLocaleString('id-ID')}`
  const translatedStatus = (value: string | null | undefined, fallback: string) => {
    const key = statusKey(value)
    return key ? t(key) : value || t(fallback)
  }

  if (loading) return <div className={styles.page}><div className={styles.state}>{t('superadmin.customerDetail.loading')}</div></div>
  if (!customer) return <div className={styles.page}><div className={styles.state}>{error || t('superadmin.customerDetail.notFound')}</div></div>

  const summary = [
    [t('superadmin.customerDetail.visitStatus'), translatedStatus(customer.visit_status, 'superadmin.status.notStarted')],
    [t('superadmin.customerDetail.paymentStatus'), translatedStatus(customer.payment_status, 'superadmin.status.notSet')],
    [t('superadmin.customerDetail.daysLeftToChurn'), customer.days_left_to_churn ?? '-'],
    [t('superadmin.customerDetail.invoiceAmount'), formatMoney(customer.invoice_amount)],
  ]

  const sections = [
    { title: t('superadmin.customerDetail.customerInfo'), items: [[t('superadmin.customerDetail.mainPhone'), customer.phone_number], [t('superadmin.customerDetail.altPhone1'), customer.alternative_phone_1], [t('superadmin.customerDetail.altPhone2'), customer.alternative_phone_2], [t('superadmin.customerDetail.altPhone3'), customer.alternative_phone_3], [t('superadmin.customerDetail.address'), customer.service_address, true]] },
    { title: t('superadmin.customerDetail.location'), items: [[t('superadmin.customerDetail.region'), customer.region], [t('superadmin.customerDetail.city'), customer.city], [t('superadmin.customerDetail.district'), customer.district], [t('superadmin.customerDetail.subDistrict'), customer.sub_district]] },
    { title: t('superadmin.customerDetail.salesInfo'), items: [[t('superadmin.customerDetail.aeName'), customer.ae_name], [t('superadmin.customerDetail.tlName'), customer.tl_name], [t('superadmin.customerDetail.smName'), customer.sm_name], [t('superadmin.customerDetail.salesChannel'), customer.sales_channel], [t('superadmin.customerDetail.billingCycle'), customer.billing_cycle]] },
    { title: t('superadmin.customerDetail.billingInfo'), items: [[t('superadmin.customerDetail.invoiceDate'), formatDate(customer.invoice_date)], [t('superadmin.customerDetail.paymentDueDate'), formatDate(customer.payment_due_date)], [t('superadmin.customerDetail.suspensionDate'), formatDate(customer.suspension_date)], [t('superadmin.customerDetail.estimatedChurnDate'), formatDate(customer.estimated_churn_date)], [t('superadmin.customerDetail.customerTenure'), customer.customer_tenure]] },
    { title: t('superadmin.customerDetail.offer'), items: [[t('superadmin.customerDetail.recommendedOffer'), customer.recommended_offer, true], [t('superadmin.customerDetail.maximumOffer'), customer.maximum_offer, true]] },
    { title: t('superadmin.customerDetail.visitInfo'), items: [[t('superadmin.customerDetail.visitStatus'), translatedStatus(customer.visit_status, 'superadmin.status.notStarted')], [t('superadmin.customerDetail.customerStatus'), translatedStatus(customer.customer_status, 'superadmin.status.unassigned')]] },
  ]

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: t('superadmin.bc.superadmin'), href: '/superadmin' },
          { label: t('superadmin.bc.customers'), href: '/superadmin/customers', icon: Building2 },
          { label: customer.customer_name || customerId },
        ]}
        title={customer.customer_name || customerId}
        description={`${customer.customer_id} · ${customer.city || customer.district || '-'}`}
      />

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>{t('superadmin.customerDetail.eyebrow')}</span>
          <h2>{t('superadmin.customerDetail.assignTitle')}</h2>
          <p>{customer.service_address || '-'}</p>
        </div>
        <span className={styles.priority}>{t('superadmin.customerDetail.priority', { rank: customer.priority_rank ?? '-' })}</span>
      </section>

      <section className={styles.summaryGrid}>
        {summary.map(([label, value]) => <article key={String(label)} className={styles.summaryCard}><span>{label}</span><strong>{String(value)}</strong></article>)}
      </section>

      <div className={styles.contentGrid}>
        {sections.map((section) => (
          <section key={section.title} className={styles.section}>
            <div className={styles.sectionHead}><h3>{section.title}</h3></div>
            <div className={styles.detailGrid}>
              {section.items.map(([label, value, full]) => <DetailItem key={String(label)} label={String(label)} value={value} full={Boolean(full)} />)}
            </div>
          </section>
        ))}

        <section className={styles.section}>
          <div className={styles.sectionHead}><h3>{t('superadmin.customerDetail.agentAssignment')}</h3></div>
          <div className={styles.assignment}>
            <label>
              {t('superadmin.customerDetail.assignedAgent')}
              <select className={styles.select} value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)}>
                <option value="">{t('superadmin.customerDetail.notAssignedOption')}</option>
                {agents.map((agent) => <option key={agent.email} value={agent.email}>{agent.agent_name}{agent.sales_code ? ` - ${agent.sales_code}` : ''}</option>)}
              </select>
            </label>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.actions}>
              <button type="button" className={styles.save} onClick={saveAssignment} disabled={saving}>
                {saving ? t('superadmin.customerDetail.saving') : t('superadmin.customerDetail.saveAssignment')}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function DetailItem({ label, value, full = false }: { label: string; value: any; full?: boolean }) {
  return <div className={`${styles.item} ${full ? styles.full : ''}`}><span>{label}</span><strong>{value === null || value === undefined || value === '' ? '-' : String(value)}</strong></div>
}
