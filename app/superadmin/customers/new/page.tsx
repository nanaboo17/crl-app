'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, MapPin, Save, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import styles from './page.module.css'

type Agent = { email: string; agent_name: string }

type FormState = {
  customer_id: string
  case_month: string
  customer_name: string
  phone_number: string
  service_address: string
  product: string
  outstanding_amount: string
  region: string
  city: string
  district: string
  sub_district: string
  given_latitude: string
  given_longitude: string
  priority_rank: string
  days_left_to_churn: string
  payment_status: string
  agent_email: string
}

const now = new Date()
const defaultCaseMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const initialForm: FormState = {
  customer_id: '',
  case_month: defaultCaseMonth,
  customer_name: '',
  phone_number: '',
  service_address: '',
  product: '',
  outstanding_amount: '',
  region: '',
  city: '',
  district: '',
  sub_district: '',
  given_latitude: '',
  given_longitude: '',
  priority_rank: 'P5',
  days_left_to_churn: '',
  payment_status: 'unpaid',
  agent_email: '',
}

function nullable(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export default function NewCustomerPage() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [form, setForm] = useState<FormState>(initialForm)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadAgents() {
      const { data, error } = await supabase
        .from('agents')
        .select('email,agent_name')
        .eq('role', 'agent')
        .eq('active', true)
        .order('agent_name')

      if (error) setError(error.message)
      setAgents((data ?? []) as Agent[])
      setLoadingAgents(false)
    }

    void loadAgents()
  }, [supabase])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: '' }))
  }

  function validate() {
    const next: Record<string, string> = {}
    if (!form.customer_id.trim()) next.customer_id = tx('Customer ID is required.', 'Customer ID wajib diisi.')
    if (!form.case_month) next.case_month = tx('Case month is required.', 'Bulan CRL wajib diisi.')
    if (!form.customer_name.trim()) next.customer_name = tx('Customer name is required.', 'Nama pelanggan wajib diisi.')
    if (form.phone_number.trim() && !/^(0|62)\d{8,13}$/.test(form.phone_number.replace(/\D/g, ''))) {
      next.phone_number = tx('Use 10–15 digits starting with 0 or 62.', 'Gunakan 10–15 digit yang diawali 0 atau 62.')
    }

    const latitude = Number(form.given_latitude)
    const longitude = Number(form.given_longitude)
    if (!form.given_latitude.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      next.given_latitude = tx('Enter a valid latitude between -90 and 90.', 'Masukkan latitude valid antara -90 dan 90.')
    }
    if (!form.given_longitude.trim() || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      next.given_longitude = tx('Enter a valid longitude between -180 and 180.', 'Masukkan longitude valid antara -180 dan 180.')
    }

    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!validate()) return

    setSaving(true)
    const customerId = form.customer_id.trim()
    const caseMonth = `${form.case_month}-01`

    try {
      const { data: existing, error: lookupError } = await supabase
        .from('customers')
        .select('crl_id,customer_id,case_month')
        .eq('customer_id', customerId)
        .eq('case_month', caseMonth)
        .maybeSingle()

      if (lookupError) throw lookupError
      if (existing) {
        setFieldErrors((current) => ({
          ...current,
          customer_id: tx('This Customer ID already exists for the selected CRL month.', 'Customer ID ini sudah terdaftar untuk bulan CRL yang dipilih.'),
          case_month: tx('Choose another CRL month for a new case.', 'Pilih bulan CRL lain untuk membuat case baru.'),
        }))
        return
      }

      const cleanPhone = form.phone_number.replace(/\D/g, '')
      const assigned = form.agent_email.trim() || null
      const priority = /^P[1-5]$/.test(form.priority_rank) ? form.priority_rank : 'P5'
      const latitude = Number(form.given_latitude)
      const longitude = Number(form.given_longitude)
      const churnDays = form.days_left_to_churn.trim() ? Number(form.days_left_to_churn) : null
      const amount = form.outstanding_amount.trim() ? Number(form.outstanding_amount) : 0

      const { data: createdCustomer, error: insertError } = await supabase.from('customers').insert({
        customer_id: customerId,
        case_month: caseMonth,
        customer_name: form.customer_name.trim(),
        phone_number: cleanPhone || null,
        service_address: nullable(form.service_address),
        product: nullable(form.product),
        outstanding_amount: Number.isFinite(amount) ? amount : 0,
        region: nullable(form.region),
        city: nullable(form.city),
        district: nullable(form.district),
        sub_district: nullable(form.sub_district),
        given_latitude: latitude,
        given_longitude: longitude,
        priority_rank: priority,
        days_left_to_churn: churnDays !== null && Number.isFinite(churnDays) ? churnDays : null,
        payment_status: form.payment_status,
        agent_email: assigned,
        customer_status: assigned ? '1. Assigned' : 'Unassigned',
        assignment_date: assigned ? new Date().toISOString().slice(0, 10) : null,
      }).select('crl_id').single()

      if (insertError) throw insertError
      if (!createdCustomer?.crl_id) throw new Error(tx('Customer was created without a CRL ID.', 'Pelanggan dibuat tanpa CRL ID.'))

      router.push(`/superadmin/customers/${encodeURIComponent(createdCustomer.crl_id)}`)
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string')
            ? String((err as { message: string }).message)
            : tx('Unable to create customer.', 'Pelanggan tidak dapat dibuat.')
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: tx('Customers', 'Pelanggan'), href: '/superadmin/customers' },
          { label: tx('New Customer', 'Pelanggan Baru'), icon: UserPlus },
        ]}
        title={tx('Add New Customer', 'Tambah Pelanggan Baru')}
        description={tx('Create a customer record and optionally assign it to an active field agent.', 'Buat data pelanggan dan, jika diperlukan, langsung tugaskan ke agen lapangan aktif.')}
      />

      <section className={styles.hero}>
        <div className={styles.heroIcon}><UserPlus aria-hidden="true" /></div>
        <div><span>{tx('CUSTOMER ONBOARDING', 'ONBOARDING PELANGGAN')}</span><h2>{tx('Start with clean customer data.', 'Mulai dengan data pelanggan yang rapi.')}</h2><p>{tx('Required fields are kept minimal; operational details can be completed later.', 'Field wajib dibuat minimal; detail operasional dapat dilengkapi setelahnya.')}</p></div>
      </section>

      <form onSubmit={submit} className={styles.form} noValidate>
        <section className={styles.card}>
          <div className={styles.cardHead}><Building2 aria-hidden="true" /><div><h3>{tx('Customer identity', 'Identitas pelanggan')}</h3><p>{tx('Core account and contact information.', 'Informasi akun dan kontak utama.')}</p></div></div>
          <div className={styles.grid}>
            <Field label="Customer ID" error={fieldErrors.customer_id}><input value={form.customer_id} onChange={(e) => set('customer_id', e.target.value)} placeholder="CUST001" /></Field>
            <Field label={tx('CRL month', 'Bulan CRL')} error={fieldErrors.case_month}><input type="month" value={form.case_month} onChange={(e) => set('case_month', e.target.value)} /></Field>
            <Field label={tx('Customer name', 'Nama pelanggan')} error={fieldErrors.customer_name}><input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} /></Field>
            <Field label={tx('Phone number', 'Nomor telepon')} error={fieldErrors.phone_number}><input inputMode="tel" value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} placeholder="08... / 62..." /></Field>
            <Field label={tx('Product', 'Produk')}><input value={form.product} onChange={(e) => set('product', e.target.value)} /></Field>
            <Field label={tx('Service address', 'Alamat layanan')} full><textarea rows={3} value={form.service_address} onChange={(e) => set('service_address', e.target.value)} /></Field>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}><MapPin aria-hidden="true" /><div><h3>{tx('Area & field ownership', 'Area & kepemilikan lapangan')}</h3><p>{tx('Location, priority, and optional agent assignment.', 'Lokasi, prioritas, dan penugasan agen opsional.')}</p></div></div>
          <div className={styles.grid}>
            <Field label={tx('Region', 'Region')}><input value={form.region} onChange={(e) => set('region', e.target.value)} /></Field>
            <Field label={tx('City', 'Kota')}><input value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label={tx('District', 'Kecamatan')}><input value={form.district} onChange={(e) => set('district', e.target.value)} /></Field>
            <Field label={tx('Sub-district', 'Kelurahan')}><input value={form.sub_district} onChange={(e) => set('sub_district', e.target.value)} /></Field>
            <Field label="Latitude" error={fieldErrors.given_latitude}><input type="number" step="any" value={form.given_latitude} onChange={(e) => set('given_latitude', e.target.value)} placeholder="-6.200000" /></Field>
            <Field label="Longitude" error={fieldErrors.given_longitude}><input type="number" step="any" value={form.given_longitude} onChange={(e) => set('given_longitude', e.target.value)} placeholder="106.816666" /></Field>
            <Field label={tx('Priority', 'Prioritas')}><select value={form.priority_rank} onChange={(e) => set('priority_rank', e.target.value)}>{[1,2,3,4,5].map((p) => <option key={p} value={`P${p}`}>P{p}</option>)}</select></Field>
            <Field label={tx('Days left to churn', 'Hari menuju churn')}><input type="number" min="0" value={form.days_left_to_churn} onChange={(e) => set('days_left_to_churn', e.target.value)} /></Field>
            <Field label={tx('Outstanding amount', 'Outstanding')}><input type="number" min="0" value={form.outstanding_amount} onChange={(e) => set('outstanding_amount', e.target.value)} placeholder="0" /></Field>
            <Field label={tx('Payment status', 'Status pembayaran')}><select value={form.payment_status} onChange={(e) => set('payment_status', e.target.value)}><option value="unpaid">{tx('Unpaid', 'Belum Dibayar')}</option><option value="paid">{tx('Paid', 'Lunas')}</option></select></Field>
            <Field label={tx('Assign agent', 'Tugaskan agen')} full><select value={form.agent_email} disabled={loadingAgents} onChange={(e) => set('agent_email', e.target.value)}><option value="">{loadingAgents ? tx('Loading agents…', 'Memuat agen…') : tx('Leave unassigned', 'Biarkan belum ditugaskan')}</option>{agents.map((agent) => <option key={agent.email} value={agent.email}>{agent.agent_name}</option>)}</select></Field>
          </div>
        </section>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <div className={styles.actions}>
          <Link href="/superadmin/customers" className={styles.cancel}>{tx('Cancel', 'Batal')}</Link>
          <button type="submit" className={styles.save} disabled={saving}><Save aria-hidden="true" />{saving ? tx('Saving…', 'Menyimpan…') : tx('Create Customer', 'Buat Pelanggan')}</button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, error, full = false, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return <label className={`${styles.field} ${full ? styles.full : ''}`}><span>{label}</span>{children}{error ? <small>{error}</small> : null}</label>
}
