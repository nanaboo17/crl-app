'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CalendarClock, MapPin, PhoneCall, Save, StickyNote, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import PageTop from '@/components/PageTop'
import styles from './page.module.css'

type FormState = {
  phone_contacted: boolean | null
  customer_available: boolean | null
  willing_to_reschedule: boolean | null
  reschedule_date: string
  direct_visit: boolean | null
  address_confirmed: boolean | null
  confirmed_address: string
  landmark: string
  wants_appointment: boolean | null
  appointment_date: string
  contact_result: string
  unpaid_reason: string
  previsit_notes: string
}

const EMPTY_FORM: FormState = {
  phone_contacted: null,
  customer_available: null,
  willing_to_reschedule: null,
  reschedule_date: '',
  direct_visit: null,
  address_confirmed: null,
  confirmed_address: '',
  landmark: '',
  wants_appointment: null,
  appointment_date: '',
  contact_result: '',
  unpaid_reason: '',
  previsit_notes: '',
}

const UNPAID_REASONS = [
  'Masalah keuangan',
  'Harga / tagihan',
  'Pindah ke provider lain',
  'Masalah jaringan / layanan',
  'Jarang digunakan',
  'Pindah alamat',
  'Masalah sales',
  'Alasan pribadi',
  'Lainnya',
]

function isoToJakartaInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function jakartaInputToIso(value: string) {
  if (!value) return null
  const normalized = value.length === 16 ? `${value}:00` : value
  const date = new Date(`${normalized}+07:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function isPast(value: string) {
  const iso = jakartaInputToIso(value)
  return Boolean(iso && new Date(iso).getTime() < Date.now())
}

export default function EditPreVisitPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = decodeURIComponent(params.id)
  const [row, setRow] = useState<any>(null)
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return router.replace('/login')

      const { data, error } = await supabase
        .from('pre_visits')
        .select('*')
        .eq('previsit_id', id)
        .ilike('agent_email', user.email.trim())
        .maybeSingle()

      if (error || !data) {
        setError(error?.message || 'Pre-visit record not found.')
        setLoading(false)
        return
      }

      const { data: customerData } = await supabase
        .from('customers')
        .select('customer_id,customer_name,phone_number,service_address,given_latitude,given_longitude')
        .eq('customer_id', data.customer_id)
        .maybeSingle()

      setRow(data)
      setCustomer(customerData || null)
      setForm({
        phone_contacted: data.phone_contacted ?? data.contact_confirmed ?? null,
        customer_available: data.customer_available ?? null,
        willing_to_reschedule: data.willing_to_reschedule ?? null,
        reschedule_date: isoToJakartaInput(data.reschedule_date),
        direct_visit: data.direct_visit ?? null,
        address_confirmed: data.address_confirmed ?? null,
        confirmed_address: data.confirmed_address || customerData?.service_address || '',
        landmark: data.landmark || '',
        wants_appointment: data.wants_appointment ?? data.appointment_confirmed ?? null,
        appointment_date: isoToJakartaInput(data.appointment_date),
        contact_result: data.contact_result || '',
        unpaid_reason: data.unpaid_reason || '',
        previsit_notes: data.previsit_notes || '',
      })
      setLoading(false)
    })()
  }, [id, router])

  const outcome = useMemo(() => {
    if (form.phone_contacted === null) return { status: 'Pending', reason: null, direct: false }
    if (form.phone_contacted) {
      if (form.customer_available === null) return { status: 'Pending', reason: null, direct: false }
      if (!form.customer_available) {
        if (form.willing_to_reschedule === null) return { status: 'Pending', reason: null, direct: false }
        if (form.willing_to_reschedule) return { status: 'Rescheduled', reason: null, direct: false }
        return { status: 'Stopped', reason: 'Pelanggan tidak tersedia dan tidak bersedia menjadwalkan ulang', direct: false }
      }
      if (form.address_confirmed === null || form.wants_appointment === null) return { status: 'Pending', reason: null, direct: false }
      if (!form.wants_appointment) return { status: 'Stopped', reason: 'Pelanggan tidak ingin membuat janji kunjungan', direct: false }
      return { status: 'Ready for Visit', reason: null, direct: false }
    }
    if (form.direct_visit === null) return { status: 'Pending', reason: null, direct: false }
    if (!form.direct_visit) return { status: 'Need Follow-up', reason: 'Pelanggan tetap perlu dikunjungi pada jadwal berikutnya', direct: false }
    return { status: 'Direct Visit', reason: null, direct: true }
  }, [form])

  const contactResults = useMemo(() => {
    if (form.phone_contacted === false) return ['Unable to Contact']
    if (form.phone_contacted === true) return ['Confirmed', 'Customer Unavailable', 'Address Mismatch', 'Customer Refused Visit', 'Account Not Recognized']
    return []
  }, [form.phone_contacted])

  function setBoolean(field: keyof FormState, value: boolean) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function setPhoneContacted(value: boolean) {
    setForm((current) => ({
      ...current,
      phone_contacted: value,
      contact_result: value ? (current.contact_result === 'Unable to Contact' ? 'Confirmed' : current.contact_result || 'Confirmed') : 'Unable to Contact',
      customer_available: value ? current.customer_available : null,
      willing_to_reschedule: value ? current.willing_to_reschedule : null,
      reschedule_date: value ? current.reschedule_date : '',
      direct_visit: value ? null : current.direct_visit,
      address_confirmed: value ? current.address_confirmed : null,
      wants_appointment: value ? current.wants_appointment : null,
      appointment_date: value ? current.appointment_date : '',
      unpaid_reason: value ? current.unpaid_reason : '',
    }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!row) return
    setError('')

    if (form.phone_contacted === null) return setError('Please confirm whether the customer was contacted.')
    if (!form.contact_result) return setError('Please select the contact result.')

    if (form.phone_contacted) {
      if (form.customer_available === null) return setError('Please confirm whether the customer is available.')
      if (!form.customer_available) {
        if (form.willing_to_reschedule === null) return setError('Please confirm whether the customer is willing to reschedule.')
        if (form.willing_to_reschedule && !form.reschedule_date) return setError('Please select the reschedule date and time.')
        if (form.willing_to_reschedule && isPast(form.reschedule_date)) return setError('Reschedule date and time must be in the future.')
      } else {
        if (form.address_confirmed === null) return setError('Please confirm the customer address.')
        if (!form.address_confirmed && !form.confirmed_address.trim()) return setError('Please enter the corrected address.')
        if (!form.unpaid_reason) return setError('Please select the unpaid reason.')
        if (form.wants_appointment === null) return setError('Please confirm whether the customer wants an appointment.')
        if (form.wants_appointment && !form.appointment_date) return setError('Please select the visit date and time.')
        if (form.wants_appointment && isPast(form.appointment_date)) return setError('Visit date and time must be in the future.')
      }
    } else if (form.direct_visit === null) {
      return setError('Please confirm whether to visit directly.')
    }

    if (!form.previsit_notes.trim()) return setError('Pre-Visit notes are required.')
    if (outcome.status === 'Pending') return setError('Please complete all required questions before saving.')

    setSaving(true)
    const supabase = createClient()
    const appointmentConfirmed = form.phone_contacted === true && form.customer_available === true && form.wants_appointment === true
    const addressConfirmed = form.address_confirmed === true

    const { error } = await supabase
      .from('pre_visits')
      .update({
        contact_confirmed: form.phone_contacted === true,
        phone_contacted: form.phone_contacted,
        customer_available: form.phone_contacted ? form.customer_available : null,
        willing_to_reschedule: form.phone_contacted && form.customer_available === false ? form.willing_to_reschedule : null,
        reschedule_date: form.phone_contacted && form.customer_available === false && form.willing_to_reschedule ? jakartaInputToIso(form.reschedule_date) : null,
        still_want_to_visit: form.phone_contacted === false ? true : null,
        address_confirmed: form.phone_contacted && form.customer_available === true ? addressConfirmed : false,
        confirmed_address: form.phone_contacted && form.customer_available === true
          ? (addressConfirmed ? customer?.service_address || form.confirmed_address.trim() || null : form.confirmed_address.trim() || null)
          : customer?.service_address || row.confirmed_address || null,
        landmark: form.landmark.trim() || null,
        wants_appointment: form.phone_contacted && form.customer_available === true ? form.wants_appointment : null,
        appointment_confirmed: appointmentConfirmed,
        appointment_date: appointmentConfirmed ? jakartaInputToIso(form.appointment_date) : null,
        contact_result: form.contact_result || null,
        unpaid_reason: form.phone_contacted && form.customer_available === true ? form.unpaid_reason || null : null,
        direct_visit: outcome.direct,
        stop_reason: outcome.reason,
        previsit_notes: form.previsit_notes.trim(),
        previsit_status: outcome.status,
      })
      .eq('previsit_id', id)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    router.replace(`/agent/pre-visits/${encodeURIComponent(id)}`)
    router.refresh()
  }

  if (loading) {
    return <main className={styles.page}><PageTop title="Edit Pre-Visit" back /><div className={styles.loading}><span className={styles.spinner} /></div></main>
  }

  return (
    <main className={styles.page}>
      <PageTop title="Edit Pre-Visit" back />

      <section className={styles.headerCard}>
        <span className={styles.eyebrow}>EDIT PRE-VISIT</span>
        <h1>{customer?.customer_name || row?.customer_id || 'Pre-Visit'}</h1>
        <p>Edit the complete pre-visit flow. Saving updates this record; it does not create a new one.</p>
        {row && <div className={styles.recordMeta}><span>{row.previsit_id}</span><span>{row.customer_id}</span><span>New status: {outcome.status}</span></div>}
      </section>

      {error && <div className={styles.error}>{error}</div>}

      {row && (
        <form onSubmit={submit} className={styles.form}>
          <section className={styles.card}>
            <div className={styles.sectionTitle}><div className={styles.sectionIcon}><PhoneCall size={18} /></div><div><h2>1. Contact customer</h2><p>Update whether the customer was successfully contacted and the contact result.</p></div></div>
            <div className={styles.question}><label>Was the customer contacted?</label><div className={styles.choiceGrid}><button type="button" className={form.phone_contacted === true ? styles.selected : ''} onClick={() => setPhoneContacted(true)}>Yes</button><button type="button" className={form.phone_contacted === false ? styles.selected : ''} onClick={() => setPhoneContacted(false)}>No</button></div></div>
            {form.phone_contacted !== null && <div className={styles.field}><label>Contact result</label><select value={form.contact_result} onChange={(e) => setForm((current) => ({ ...current, contact_result: e.target.value }))}><option value="">Select result</option>{contactResults.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>}
          </section>

          {form.phone_contacted === true && (
            <section className={styles.card}>
              <div className={styles.sectionTitle}><div className={styles.sectionIcon}><UserCheck size={18} /></div><div><h2>2. Customer availability</h2><p>Update availability and rescheduling information.</p></div></div>
              <div className={styles.question}><label>Is the customer available?</label><div className={styles.choiceGrid}><button type="button" className={form.customer_available === true ? styles.selected : ''} onClick={() => setBoolean('customer_available', true)}>Yes</button><button type="button" className={form.customer_available === false ? styles.selected : ''} onClick={() => setBoolean('customer_available', false)}>No</button></div></div>
              {form.customer_available === false && <><div className={styles.question}><label>Willing to reschedule?</label><div className={styles.choiceGrid}><button type="button" className={form.willing_to_reschedule === true ? styles.selected : ''} onClick={() => setBoolean('willing_to_reschedule', true)}>Yes</button><button type="button" className={form.willing_to_reschedule === false ? styles.selected : ''} onClick={() => setBoolean('willing_to_reschedule', false)}>No</button></div></div>{form.willing_to_reschedule === true && <div className={styles.field}><label>Reschedule date & time</label><input type="datetime-local" value={form.reschedule_date} onChange={(e) => setForm((current) => ({ ...current, reschedule_date: e.target.value }))} /></div>}</>}
            </section>
          )}

          {form.phone_contacted === false && (
            <section className={styles.card}>
              <div className={styles.sectionTitle}><div className={styles.sectionIcon}><MapPin size={18} /></div><div><h2>2. Continue to field visit</h2><p>Choose whether the agent should go directly to the customer location.</p></div></div>
              <div className={styles.question}><label>Visit directly?</label><div className={styles.choiceGrid}><button type="button" className={form.direct_visit === true ? styles.selected : ''} onClick={() => setBoolean('direct_visit', true)}>Yes, visit directly</button><button type="button" className={form.direct_visit === false ? styles.selected : ''} onClick={() => setBoolean('direct_visit', false)}>No, follow up later</button></div></div>
            </section>
          )}

          {form.phone_contacted === true && form.customer_available === true && (
            <section className={styles.card}>
              <div className={styles.sectionTitle}><div className={styles.sectionIcon}><MapPin size={18} /></div><div><h2>3. Address & reason</h2><p>Update address confirmation, landmark, and reason for non-payment.</p></div></div>
              <div className={styles.question}><label>Is the registered address correct?</label><div className={styles.choiceGrid}><button type="button" className={form.address_confirmed === true ? styles.selected : ''} onClick={() => setBoolean('address_confirmed', true)}>Yes</button><button type="button" className={form.address_confirmed === false ? styles.selected : ''} onClick={() => setBoolean('address_confirmed', false)}>No</button></div></div>
              {form.address_confirmed === false && <div className={styles.field}><label>Corrected address</label><textarea value={form.confirmed_address} onChange={(e) => setForm((current) => ({ ...current, confirmed_address: e.target.value }))} /></div>}
              <div className={styles.field}><label>Landmark</label><input value={form.landmark} onChange={(e) => setForm((current) => ({ ...current, landmark: e.target.value }))} /></div>
              <div className={styles.field}><label>Unpaid reason</label><select value={form.unpaid_reason} onChange={(e) => setForm((current) => ({ ...current, unpaid_reason: e.target.value }))}><option value="">Select reason</option>{UNPAID_REASONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
            </section>
          )}

          {form.phone_contacted === true && form.customer_available === true && (
            <section className={styles.card}>
              <div className={styles.sectionTitle}><div className={styles.sectionIcon}><CalendarClock size={18} /></div><div><h2>4. Visit appointment</h2><p>Update whether the customer agrees to a visit appointment.</p></div></div>
              <div className={styles.question}><label>Does the customer want an appointment?</label><div className={styles.choiceGrid}><button type="button" className={form.wants_appointment === true ? styles.selected : ''} onClick={() => setBoolean('wants_appointment', true)}>Yes</button><button type="button" className={form.wants_appointment === false ? styles.selected : ''} onClick={() => setBoolean('wants_appointment', false)}>No</button></div></div>
              {form.wants_appointment === true && <div className={styles.field}><label>Appointment date & time</label><input type="datetime-local" value={form.appointment_date} onChange={(e) => setForm((current) => ({ ...current, appointment_date: e.target.value }))} /></div>}
            </section>
          )}

          <section className={styles.card}>
            <div className={styles.sectionTitle}><div className={styles.sectionIcon}><StickyNote size={18} /></div><div><h2>Final notes</h2><p>Notes are required. The pre-visit status below is recalculated from the edited answers.</p></div></div>
            <div className={styles.statusBox}><span>Calculated status</span><strong>{outcome.status}</strong>{outcome.reason && <small>{outcome.reason}</small>}</div>
            <div className={styles.field}><label>Pre-Visit notes *</label><textarea className={styles.notes} required value={form.previsit_notes} onChange={(e) => setForm((current) => ({ ...current, previsit_notes: e.target.value }))} /></div>
          </section>

          <div className={styles.actions}><button type="button" className={styles.cancelButton} onClick={() => router.back()}>Cancel</button><button type="submit" disabled={saving || outcome.status === 'Pending'} className={styles.saveButton}><Save size={17} /> {saving ? 'Saving…' : 'Save all changes'}</button></div>
        </form>
      )}
    </main>
  )
}
