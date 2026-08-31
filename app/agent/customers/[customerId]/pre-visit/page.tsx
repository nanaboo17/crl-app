'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'

export default function PreVisitPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const customerId = decodeURIComponent(
    params.customerId as string
  )

  const [customer, setCustomer] = useState<any>(null)
  const [userEmail, setUserEmail] = useState('')

  const [contactConfirmed, setContactConfirmed] = useState(false)
  const [addressConfirmed, setAddressConfirmed] = useState(false)
  const [confirmedAddress, setConfirmedAddress] = useState('')
  const [landmark, setLandmark] = useState('')
  const [appointmentConfirmed, setAppointmentConfirmed] =
    useState(false)
  const [appointmentDate, setAppointmentDate] = useState('')
  const [contactResult, setContactResult] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadPage() {
      setLoading(true)
      setError('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.email) {
        router.replace('/login')
        return
      }

      const email = user.email.trim().toLowerCase()
      setUserEmail(email)

      const { data: customerData, error: customerError } =
        await supabase
          .from('customers')
          .select(`
            customer_id,
            customer_name,
            phone_number,
            service_address,
            city,
            district,
            sub_district,
            agent_email,
            visit_status
          `)
          .eq('customer_id', customerId)
          .eq('agent_email', email)
          .maybeSingle()

      if (customerError) {
        setError(customerError.message)
        setLoading(false)
        return
      }

      if (!customerData) {
        setError('Customer not found or not assigned to you.')
        setLoading(false)
        return
      }

      setCustomer(customerData)

      const { data: existing } = await supabase
        .from('pre_visits')
        .select('*')
        .eq('customer_id', customerId)
        .eq('agent_email', email)
        .maybeSingle()

      if (existing) {
        setContactConfirmed(existing.contact_confirmed)
        setAddressConfirmed(existing.address_confirmed)
        setConfirmedAddress(existing.confirmed_address ?? '')
        setLandmark(existing.landmark ?? '')
        setAppointmentConfirmed(existing.appointment_confirmed)

        if (existing.appointment_date) {
          const date = new Date(existing.appointment_date)

          setAppointmentDate(
            new Date(
              date.getTime() -
                date.getTimezoneOffset() * 60000
            )
              .toISOString()
              .slice(0, 16)
          )
        }

        setContactResult(existing.contact_result ?? '')
        setNotes(existing.previsit_notes ?? '')
      } else {
        setConfirmedAddress(customerData.service_address ?? '')
      }

      setLoading(false)
    }

    loadPage()
  }, [customerId])

  function determineStatus() {
    if (
      contactConfirmed &&
      addressConfirmed &&
      appointmentConfirmed
    ) {
      return 'Ready for Visit'
    }

    if (
      contactResult === 'Address Mismatch' ||
      contactResult === 'Unsafe / Access Restricted' ||
      contactResult === 'Account Not Recognized'
    ) {
      return 'Supervisor Review'
    }

    if (
      contactResult === 'Unable to Contact' ||
      contactResult === 'Customer Unavailable'
    ) {
      return 'Need Follow-up'
    }

    if (contactResult === 'Customer Refused Visit') {
      return 'Cancelled'
    }

    return 'Pending'
  }

  async function savePreVisit() {
    if (!contactResult) {
      setError('Please select a contact result.')
      return
    }

    if (
      appointmentConfirmed &&
      !appointmentDate
    ) {
      setError(
        'Please select the appointment date and time.'
      )
      return
    }

    setSaving(true)
    setError('')

    const previsitStatus = determineStatus()

    const payload = {
      customer_id: customerId,
      agent_email: userEmail,

      contact_confirmed: contactConfirmed,
      address_confirmed: addressConfirmed,

      confirmed_address:
        confirmedAddress.trim() || null,

      landmark:
        landmark.trim() || null,

      appointment_confirmed:
        appointmentConfirmed,

      appointment_date:
        appointmentConfirmed && appointmentDate
          ? new Date(appointmentDate).toISOString()
          : null,

      contact_result: contactResult,

      previsit_notes:
        notes.trim() || null,

      previsit_status:
        previsitStatus,
    }

    const { data: existing } = await supabase
      .from('pre_visits')
      .select('previsit_id')
      .eq('customer_id', customerId)
      .maybeSingle()

    let saveError

    if (existing) {
      const { error } = await supabase
        .from('pre_visits')
        .update(payload)
        .eq('previsit_id', existing.previsit_id)

      saveError = error
    } else {
      const { error } = await supabase
        .from('pre_visits')
        .insert(payload)

      saveError = error
    }

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    router.push(
      `/agent/customers/${encodeURIComponent(
        customerId
      )}`
    )

    router.refresh()
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <p>Loading pre-visit...</p>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className={styles.page}>
        <div className={styles.errorCard}>
          {error || 'Customer not found.'}
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <button
        type="button"
        className={styles.backButton}
        onClick={() =>
          router.push(
            `/agent/customers/${encodeURIComponent(
              customerId
            )}`
          )
        }
      >
        ← Back
      </button>

      <header className={styles.header}>
        <p className={styles.eyebrow}>
          PRE-VISIT
        </p>

        <h1>Customer Confirmation</h1>

        <p>
          Complete this before going to the customer's location.
        </p>
      </header>

      <section className={styles.customerCard}>
        <span>Customer</span>

        <h2>{customer.customer_name}</h2>

        <p>{customer.customer_id}</p>

        <div className={styles.customerInfo}>
          <div>
            <span>Phone</span>
            <strong>
              {customer.phone_number || '-'}
            </strong>
          </div>

          <div>
            <span>Area</span>
            <strong>
              {customer.sub_district ||
                customer.district ||
                customer.city ||
                '-'}
            </strong>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <h2>1. Contact Confirmation</h2>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={contactConfirmed}
            onChange={(e) =>
              setContactConfirmed(
                e.target.checked
              )
            }
          />

          Customer / authorized person contacted
        </label>

        <label>
          Contact Result

          <select
            value={contactResult}
            onChange={(e) =>
              setContactResult(e.target.value)
            }
          >
            <option value="">
              Select result
            </option>

            <option value="Confirmed">
              Confirmed
            </option>

            <option value="Unable to Contact">
              Unable to Contact
            </option>

            <option value="Customer Unavailable">
              Customer Unavailable
            </option>

            <option value="Address Mismatch">
              Address Mismatch
            </option>

            <option value="Customer Refused Visit">
              Customer Refused Visit
            </option>

            <option value="Unsafe / Access Restricted">
              Unsafe / Access Restricted
            </option>

            <option value="Account Not Recognized">
              Account Not Recognized
            </option>
          </select>
        </label>
      </section>

      <section className={styles.card}>
        <h2>2. Address Confirmation</h2>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={addressConfirmed}
            onChange={(e) =>
              setAddressConfirmed(
                e.target.checked
              )
            }
          />

          Installation address confirmed
        </label>

        <label>
          Confirmed Address

          <textarea
            value={confirmedAddress}
            onChange={(e) =>
              setConfirmedAddress(
                e.target.value
              )
            }
          />
        </label>

        <label>
          Landmark

          <input
            value={landmark}
            onChange={(e) =>
              setLandmark(e.target.value)
            }
            placeholder="Example: next to Alfamart"
          />
        </label>
      </section>

      <section className={styles.card}>
        <h2>3. Appointment</h2>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={appointmentConfirmed}
            onChange={(e) =>
              setAppointmentConfirmed(
                e.target.checked
              )
            }
          />

          Visit appointment confirmed
        </label>

        {appointmentConfirmed && (
          <label>
            Appointment Date & Time

            <input
              type="datetime-local"
              value={appointmentDate}
              onChange={(e) =>
                setAppointmentDate(
                  e.target.value
                )
              }
            />
          </label>
        )}
      </section>

      <section className={styles.card}>
        <h2>4. Notes</h2>

        <label>
          Pre-Visit Notes

          <textarea
            value={notes}
            onChange={(e) =>
              setNotes(e.target.value)
            }
            placeholder="Add important information for the visit..."
          />
        </label>
      </section>

      <section className={styles.statusCard}>
        <span>Pre-Visit Status</span>

        <strong>
          {determineStatus()}
        </strong>
      </section>

      {error && (
        <div className={styles.errorCard}>
          {error}
        </div>
      )}

      <button
        type="button"
        className={styles.saveButton}
        onClick={savePreVisit}
        disabled={saving}
      >
        {saving
          ? 'Saving...'
          : 'Save Pre-Visit'}
      </button>
    </main>
  )
}