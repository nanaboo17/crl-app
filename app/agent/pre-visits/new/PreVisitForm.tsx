'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getCurrentProfile } from '@/lib/auth'
import type { Customer } from '@/lib/types'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
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
  previsit_notes: string
}

const initialForm: FormState = {
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
  previsit_notes: '',
}

export default function PreVisitForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const customerId = sp.get('customer') || ''

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(initialForm)

  useEffect(() => {
    ;(async () => {
      if (!customerId) {
        setError('Customer ID is missing.')
        setLoading(false)
        return
      }

      const s = createClient()
      const { data, error } = await s
        .from('customers')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      if (error) setError(error.message)
      else setCustomer(data as Customer)

      setLoading(false)
    })()
  }, [customerId])

  const outcome = useMemo(() => {
    if (form.phone_contacted === null) {
      return { status: 'Pending', reason: null, direct: false }
    }

    if (form.phone_contacted) {
      if (form.customer_available === null) {
        return { status: 'Pending', reason: null, direct: false }
      }

      if (!form.customer_available) {
        if (form.willing_to_reschedule === null) {
          return { status: 'Pending', reason: null, direct: false }
        }
        if (form.willing_to_reschedule) {
          return { status: 'Rescheduled', reason: null, direct: false }
        }
        return {
          status: 'Stopped',
          reason: 'Customer unavailable and not willing to reschedule',
          direct: false,
        }
      }

      if (form.address_confirmed === null) {
        return { status: 'Pending', reason: null, direct: false }
      }

      if (form.wants_appointment === null) {
        return { status: 'Pending', reason: null, direct: false }
      }

      if (!form.wants_appointment) {
        return {
          status: 'Stopped',
          reason: 'Customer does not want an appointment',
          direct: false,
        }
      }

      return { status: 'Ready for Visit', reason: null, direct: false }
    }

    if (form.direct_visit === null) {
      return { status: 'Pending', reason: null, direct: false }
    }

    if (!form.direct_visit) {
      return { status: 'Ended', reason: 'No contact and no direct visit', direct: false }
    }

    return { status: 'Direct Visit', reason: null, direct: true }
  }, [form])

  const customerLat = Number(customer?.given_latitude)
  const customerLng = Number(customer?.given_longitude)
  const hasCustomerCoordinates =
    Number.isFinite(customerLat) &&
    Number.isFinite(customerLng) &&
    customer?.given_latitude !== null &&
    customer?.given_latitude !== undefined &&
    customer?.given_longitude !== null &&
    customer?.given_longitude !== undefined

  const customerMapQuery = hasCustomerCoordinates
    ? `${customerLat},${customerLng}`
    : customer?.service_address?.trim() || ''

  const customerMapEmbedUrl = customerMapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(customerMapQuery)}&z=16&output=embed`
    : ''

  const customerNavigationUrl = hasCustomerCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${customerLat},${customerLng}&travelmode=driving`
    : customerMapQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customerMapQuery)}`
      : ''

  function setBoolean(field: keyof FormState, value: boolean) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (form.phone_contacted === null) {
        throw new Error('Please confirm whether the phone was contacted.')
      }

      if (form.phone_contacted) {
        if (form.customer_available === null) {
          throw new Error('Please confirm whether the customer is available.')
        }

        if (!form.customer_available) {
          if (form.willing_to_reschedule === null) {
            throw new Error('Please confirm whether the customer is willing to reschedule.')
          }
          if (form.willing_to_reschedule && !form.reschedule_date) {
            throw new Error('Please select the reschedule date and time.')
          }
        } else {
          if (form.address_confirmed === null) {
            throw new Error('Please confirm the customer address.')
          }
          if (!form.address_confirmed && !form.confirmed_address.trim()) {
            throw new Error('Please enter the corrected address.')
          }
          if (form.wants_appointment === null) {
            throw new Error('Please confirm whether the customer wants an appointment.')
          }
          if (form.wants_appointment && !form.appointment_date) {
            throw new Error('Please select the appointment date and time.')
          }
        }
      } else if (form.direct_visit === null) {
        throw new Error('Please confirm whether to visit directly.')
      }

      const p = await getCurrentProfile()
      const s = createClient()

      const appointmentConfirmed =
        form.phone_contacted === true &&
        form.customer_available === true &&
        form.wants_appointment === true

      const addressConfirmed = form.address_confirmed === true

      const payload = {
        customer_id: customerId,
        agent_email: p.email,
        contact_attempt_date: new Date().toISOString(),
        contact_confirmed: form.phone_contacted === true,
        phone_contacted: form.phone_contacted,
        customer_available: form.phone_contacted ? form.customer_available : null,
        willing_to_reschedule:
          form.phone_contacted && form.customer_available === false
            ? form.willing_to_reschedule
            : null,
        reschedule_date:
          form.phone_contacted &&
          form.customer_available === false &&
          form.willing_to_reschedule &&
          form.reschedule_date
            ? new Date(form.reschedule_date).toISOString()
            : null,
        still_want_to_visit: form.phone_contacted === false ? form.direct_visit : null,
        address_confirmed: addressConfirmed,
        confirmed_address:
          form.phone_contacted && form.customer_available
            ? addressConfirmed
              ? customer?.service_address || null
              : form.confirmed_address.trim() || null
            : customer?.service_address || null,
        landmark: form.landmark.trim() || null,
        address_safe: null,
        wants_appointment:
          form.phone_contacted && form.customer_available
            ? form.wants_appointment
            : null,
        appointment_confirmed: appointmentConfirmed,
        appointment_date:
          appointmentConfirmed && form.appointment_date
            ? new Date(form.appointment_date).toISOString()
            : null,
        contact_result: form.contact_result || null,
        supervisor_approval: false,
        direct_visit: outcome.direct,
        stop_reason: outcome.reason,
        previsit_notes: form.previsit_notes.trim() || null,
        previsit_status: outcome.status,
      }

      const { data, error } = await s
        .from('pre_visits')
        .insert(payload)
        .select('previsit_id')
        .single()

      if (error) throw error

      router.replace(`/agent/pre-visits/${encodeURIComponent(data.previsit_id)}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="container">
        <PageTop title="New Pre-Visit" back />
        <Loading />
      </main>
    )
  }

  return (
    <main className="container">
      <PageTop title="New Pre-Visit" back />

      <form className={styles.form} onSubmit={submit}>
        <section className={styles.customerCard}>
          <span>Customer</span>
          <strong>{customer?.customer_name || '—'}</strong>
          <small>{customer?.customer_id}</small>
          <small>{customer?.phone_number || 'No phone number'}</small>
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepTitle}>
            <span>1</span>
            <div>
              <h2>Contact Customer</h2>
              <p>Try the registered customer phone number.</p>
            </div>
          </div>

          <div className={styles.question}>
            <label>Was the phone contacted?</label>
            <div className={styles.choiceGrid}>
              <button type="button" className={form.phone_contacted === true ? styles.selected : ''} onClick={() => setBoolean('phone_contacted', true)}>Yes</button>
              <button type="button" className={form.phone_contacted === false ? styles.selected : ''} onClick={() => setBoolean('phone_contacted', false)}>No</button>
            </div>
          </div>

          <div className={styles.field}>
            <label>Contact result</label>
            <select value={form.contact_result} onChange={(e) => setForm({ ...form, contact_result: e.target.value })}>
              <option value="">Select result</option>
              <option>Confirmed</option>
              <option>Unable to Contact</option>
              <option>Customer Unavailable</option>
              <option>Address Mismatch</option>
              <option>Customer Refused Visit</option>
              <option>Account Not Recognized</option>
            </select>
          </div>
        </section>

        {form.phone_contacted === true && (
          <section className={styles.stepCard}>
            <div className={styles.stepTitle}>
              <span>2</span>
              <div>
                <h2>Customer Availability</h2>
                <p>Confirm whether the customer can continue the pre-visit discussion.</p>
              </div>
            </div>

            <div className={styles.question}>
              <label>Is the customer available?</label>
              <div className={styles.choiceGrid}>
                <button type="button" className={form.customer_available === true ? styles.selected : ''} onClick={() => setBoolean('customer_available', true)}>Yes</button>
                <button type="button" className={form.customer_available === false ? styles.selected : ''} onClick={() => setBoolean('customer_available', false)}>No</button>
              </div>
            </div>

            {form.customer_available === false && (
              <>
                <div className={styles.question}>
                  <label>Is the customer willing to reschedule?</label>
                  <div className={styles.choiceGrid}>
                    <button type="button" className={form.willing_to_reschedule === true ? styles.selected : ''} onClick={() => setBoolean('willing_to_reschedule', true)}>Yes</button>
                    <button type="button" className={form.willing_to_reschedule === false ? styles.selected : ''} onClick={() => setBoolean('willing_to_reschedule', false)}>No</button>
                  </div>
                </div>

                {form.willing_to_reschedule === true && (
                  <div className={styles.field}>
                    <label>Reschedule date & time</label>
                    <input type="datetime-local" value={form.reschedule_date} onChange={(e) => setForm({ ...form, reschedule_date: e.target.value })} />
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {form.phone_contacted === true && form.customer_available === true && (
          <section className={styles.stepCard}>
            <div className={styles.stepTitle}>
              <span>3</span>
              <div>
                <h2>Address</h2>
                <p>Validate the installation address before the field visit.</p>
              </div>
            </div>

            <div className={styles.question}>
              <label>Is the address confirmed?</label>
              <div className={styles.choiceGrid}>
                <button type="button" className={form.address_confirmed === true ? styles.selected : ''} onClick={() => setBoolean('address_confirmed', true)}>Yes</button>
                <button type="button" className={form.address_confirmed === false ? styles.selected : ''} onClick={() => setBoolean('address_confirmed', false)}>No</button>
              </div>
            </div>

            {form.address_confirmed === false && (
              <div className={styles.field}>
                <label>Corrected / confirmed address</label>
                <textarea value={form.confirmed_address} onChange={(e) => setForm({ ...form, confirmed_address: e.target.value })} />
              </div>
            )}

            <div className={styles.field}>
              <label>Landmark / access note</label>
              <textarea value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} placeholder="Nearest landmark or access note" />
            </div>
          </section>
        )}

        {form.phone_contacted === true && form.customer_available === true && (
          <section className={styles.stepCard}>
            <div className={styles.stepTitle}>
              <span>4</span>
              <div>
                <h2>Appointment</h2>
                <p>Confirm whether the customer agrees to a visit schedule.</p>
              </div>
            </div>

            <div className={styles.question}>
              <label>Does the customer want to make an appointment?</label>
              <div className={styles.choiceGrid}>
                <button type="button" className={form.wants_appointment === true ? styles.selected : ''} onClick={() => setBoolean('wants_appointment', true)}>Yes</button>
                <button type="button" className={form.wants_appointment === false ? styles.selected : ''} onClick={() => setBoolean('wants_appointment', false)}>No</button>
              </div>
            </div>

            {form.wants_appointment === true && (
              <div className={styles.field}>
                <label>Appointment date & time</label>
                <input type="datetime-local" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} />
              </div>
            )}
          </section>
        )}

        {form.phone_contacted === false && (
          <section className={styles.stepCard}>
            <div className={styles.stepTitle}>
              <span>2</span>
              <div>
                <h2>Direct Visit Decision</h2>
                <p>The phone could not be contacted.</p>
              </div>
            </div>

            <div className={styles.question}>
              <label>Visit directly?</label>
              <div className={styles.choiceGrid}>
                <button type="button" className={form.direct_visit === true ? styles.selected : ''} onClick={() => setBoolean('direct_visit', true)}>Yes</button>
                <button type="button" className={form.direct_visit === false ? styles.selected : ''} onClick={() => setBoolean('direct_visit', false)}>No</button>
              </div>
            </div>

            {form.direct_visit === true && (
              <div className={styles.directVisitMap}>
                <div className={styles.mapHeader}>
                  <div>
                    <span>Customer location</span>
                    <strong>{customer?.service_address || 'Address not available'}</strong>
                  </div>
                  {hasCustomerCoordinates && (
                    <small>{customerLat.toFixed(6)}, {customerLng.toFixed(6)}</small>
                  )}
                </div>

                {customerMapEmbedUrl ? (
                  <iframe
                    title={`Map for ${customer?.customer_name || 'customer'}`}
                    src={customerMapEmbedUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <div className={styles.mapUnavailable}>Customer location is not available.</div>
                )}

                {customerNavigationUrl && (
                  <a
                    href={customerNavigationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.navigateButton}
                  >
                    Open in Google Maps
                  </a>
                )}
              </div>
            )}
          </section>
        )}

        <section className={styles.stepCard}>
          <div className={styles.stepTitle}>
            <span>✓</span>
            <div>
              <h2>Closure</h2>
              <p>The status is calculated automatically from the answers above.</p>
            </div>
          </div>

          <div className={styles.statusBox}>
            <span>Pre-Visit status</span>
            <strong>{outcome.status}</strong>
            {outcome.reason && <small>{outcome.reason}</small>}
          </div>

          <div className={styles.field}>
            <label>Notes</label>
            <textarea value={form.previsit_notes} onChange={(e) => setForm({ ...form, previsit_notes: e.target.value })} placeholder="Optional additional notes" />
          </div>
        </section>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submitButton} disabled={saving || outcome.status === 'Pending'}>
          {saving ? 'Saving…' : 'Save Pre-Visit'}
        </button>
      </form>
    </main>
  )
}
