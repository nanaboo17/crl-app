'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getCurrentProfile } from '@/lib/auth'
import type { Customer } from '@/lib/types'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import { useI18n } from '@/components/providers/i18n-provider'
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

function jakartaInputNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function jakartaLocalToIso(value: string) {
  if (!value) return null
  const normalized = value.length === 16 ? `${value}:00` : value
  const date = new Date(`${normalized}+07:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function isPastJakartaDateTime(value: string) {
  const iso = jakartaLocalToIso(value)
  return Boolean(iso && new Date(iso).getTime() < Date.now())
}

export default function PreVisitForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const customerId = sp.get('customer') || ''
  const { locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(initialForm)
  const [minDateTime, setMinDateTime] = useState('')

  useEffect(() => {
    setMinDateTime(jakartaInputNow())
  }, [])

  useEffect(() => {
    ;(async () => {
      if (!customerId) {
        setError(tx('Customer ID is missing.', 'ID pelanggan tidak tersedia.'))
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
    if (form.phone_contacted === null) return { status: 'Pending', reason: null, direct: false }

    if (form.phone_contacted) {
      if (form.customer_available === null) return { status: 'Pending', reason: null, direct: false }

      if (!form.customer_available) {
        if (form.willing_to_reschedule === null) return { status: 'Pending', reason: null, direct: false }
        if (form.willing_to_reschedule) return { status: 'Rescheduled', reason: null, direct: false }
        return {
          status: 'Stopped',
          reason: tx(
            'Customer unavailable and not willing to reschedule',
            'Pelanggan tidak tersedia dan tidak bersedia menjadwalkan ulang'
          ),
          direct: false,
        }
      }

      if (form.address_confirmed === null) return { status: 'Pending', reason: null, direct: false }
      if (form.wants_appointment === null) return { status: 'Pending', reason: null, direct: false }

      if (!form.wants_appointment) {
        return {
          status: 'Stopped',
          reason: tx(
            'Customer does not want an appointment',
            'Pelanggan tidak ingin membuat janji kunjungan'
          ),
          direct: false,
        }
      }

      return { status: 'Ready for Visit', reason: null, direct: false }
    }

    if (form.direct_visit === null) return { status: 'Pending', reason: null, direct: false }

    if (!form.direct_visit) {
      return {
        status: 'Need Follow-up',
        reason: tx(
          'Customer still requires a visit on a later schedule',
          'Pelanggan tetap perlu dikunjungi pada jadwal berikutnya'
        ),
        direct: false,
      }
    }

    return { status: 'Direct Visit', reason: null, direct: true }
  }, [form, locale])

  const contactResults = useMemo(() => {
    if (form.phone_contacted === false) {
      return [{ value: 'Unable to Contact', label: tx('Unable to Contact', 'Tidak Dapat Dihubungi') }]
    }

    if (form.phone_contacted === true) {
      return [
        { value: 'Confirmed', label: tx('Confirmed', 'Terkonfirmasi') },
        { value: 'Customer Unavailable', label: tx('Customer Unavailable', 'Pelanggan Tidak Tersedia') },
        { value: 'Address Mismatch', label: tx('Address Mismatch', 'Alamat Tidak Sesuai') },
        { value: 'Customer Refused Visit', label: tx('Customer Refused Visit', 'Pelanggan Menolak Kunjungan') },
        { value: 'Account Not Recognized', label: tx('Account Not Recognized', 'Akun Tidak Dikenali') },
      ]
    }

    return []
  }, [form.phone_contacted, locale])

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

  function setPhoneContacted(value: boolean) {
    setForm((current) => ({
      ...current,
      phone_contacted: value,
      contact_result: value ? 'Confirmed' : 'Unable to Contact',
      customer_available: null,
      willing_to_reschedule: null,
      reschedule_date: '',
      direct_visit: null,
      address_confirmed: null,
      confirmed_address: '',
      landmark: '',
      wants_appointment: null,
      appointment_date: '',
    }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (form.phone_contacted === null) {
        throw new Error(tx('Please confirm whether the phone was contacted.', 'Konfirmasi apakah nomor telepon berhasil dihubungi.'))
      }
      if (!form.contact_result) {
        throw new Error(tx('Please select the contact result.', 'Pilih hasil kontak.'))
      }

      if (form.phone_contacted) {
        if (form.customer_available === null) {
          throw new Error(tx('Please confirm whether the customer is available.', 'Konfirmasi apakah pelanggan tersedia.'))
        }

        if (!form.customer_available) {
          if (form.willing_to_reschedule === null) {
            throw new Error(tx('Please confirm whether the customer is willing to reschedule.', 'Konfirmasi apakah pelanggan bersedia menjadwalkan ulang.'))
          }
          if (form.willing_to_reschedule && !form.reschedule_date) {
            throw new Error(tx('Please select the reschedule date and time.', 'Pilih tanggal dan waktu penjadwalan ulang.'))
          }
          if (form.willing_to_reschedule && isPastJakartaDateTime(form.reschedule_date)) {
            throw new Error(tx('Reschedule date and time must be in the future.', 'Tanggal dan waktu penjadwalan ulang harus di masa mendatang.'))
          }
        } else {
          if (form.address_confirmed === null) {
            throw new Error(tx('Please confirm the customer address.', 'Konfirmasi alamat pelanggan.'))
          }
          if (!form.address_confirmed && !form.confirmed_address.trim()) {
            throw new Error(tx('Please enter the corrected address.', 'Masukkan alamat yang sudah dikoreksi.'))
          }
          if (form.wants_appointment === null) {
            throw new Error(tx('Please confirm whether the customer wants an appointment.', 'Konfirmasi apakah pelanggan ingin membuat janji kunjungan.'))
          }
          if (form.wants_appointment && !form.appointment_date) {
            throw new Error(tx('Please select the visit date and time.', 'Pilih tanggal dan waktu kunjungan.'))
          }
          if (form.wants_appointment && isPastJakartaDateTime(form.appointment_date)) {
            throw new Error(tx('Visit date and time must be in the future.', 'Tanggal dan waktu kunjungan harus di masa mendatang.'))
          }
        }
      } else if (form.direct_visit === null) {
        throw new Error(tx('Please confirm whether to visit directly.', 'Konfirmasi apakah akan langsung melakukan kunjungan.'))
      }

      const p = await getCurrentProfile()
      const s = createClient()

      const appointmentConfirmed =
        form.phone_contacted === true &&
        form.customer_available === true &&
        form.wants_appointment === true

      const addressConfirmed = form.address_confirmed === true
      const rescheduleIso = jakartaLocalToIso(form.reschedule_date)
      const appointmentIso = jakartaLocalToIso(form.appointment_date)

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
          form.willing_to_reschedule
            ? rescheduleIso
            : null,
        still_want_to_visit: form.phone_contacted === false ? true : null,
        address_confirmed: addressConfirmed,
        confirmed_address:
          form.phone_contacted && form.customer_available
            ? addressConfirmed
              ? customer?.service_address || null
              : form.confirmed_address.trim() || null
            : customer?.service_address || null,
        landmark: form.landmark.trim() || null,
        wants_appointment:
          form.phone_contacted && form.customer_available
            ? form.wants_appointment
            : null,
        appointment_confirmed: appointmentConfirmed,
        appointment_date: appointmentConfirmed ? appointmentIso : null,
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
        <PageTop title={tx('New Pre-Visit', 'Pra-Kunjungan Baru')} back />
        <Loading />
      </main>
    )
  }

  return (
    <main className="container">
      <PageTop title={tx('New Pre-Visit', 'Pra-Kunjungan Baru')} back />

      <form className={styles.form} onSubmit={submit}>
        <section className={styles.customerCard}>
          <span>{tx('Customer', 'Pelanggan')}</span>
          <strong>{customer?.customer_name || '—'}</strong>
          <small>{customer?.customer_id}</small>
          <small>{customer?.phone_number || tx('No phone number', 'Nomor telepon tidak tersedia')}</small>
        </section>

        <section className={styles.stepCard}>
          <div className={styles.stepTitle}>
            <span>1</span>
            <div>
              <h2>{tx('Contact Customer', 'Hubungi Pelanggan')}</h2>
              <p>{tx('Try the registered customer phone number.', 'Hubungi nomor telepon pelanggan yang terdaftar.')}</p>
            </div>
          </div>

          <div className={styles.question}>
            <label>{tx('Was the phone contacted?', 'Apakah pelanggan berhasil dihubungi?')}</label>
            <div className={styles.choiceGrid}>
              <button type="button" className={form.phone_contacted === true ? styles.selected : ''} onClick={() => setPhoneContacted(true)}>{tx('Yes', 'Ya')}</button>
              <button type="button" className={form.phone_contacted === false ? styles.selected : ''} onClick={() => setPhoneContacted(false)}>{tx('No', 'Tidak')}</button>
            </div>
          </div>

          <div className={styles.question}>
            <label>{tx('Contact result', 'Hasil kontak')}</label>
            {form.phone_contacted === null ? (
              <small>{tx('Choose Yes or No above first.', 'Pilih Ya atau Tidak di atas terlebih dahulu.')}</small>
            ) : (
              <div className={styles.choiceGrid}>
                {contactResults.map((result) => (
                  <button
                    key={result.value}
                    type="button"
                    className={form.contact_result === result.value ? styles.selected : ''}
                    onClick={() => setForm((current) => ({ ...current, contact_result: result.value }))}
                  >
                    {result.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {form.phone_contacted === true && (
          <section className={styles.stepCard}>
            <div className={styles.stepTitle}>
              <span>2</span>
              <div>
                <h2>{tx('Customer Availability', 'Ketersediaan Pelanggan')}</h2>
                <p>{tx('Confirm whether the customer can continue the pre-visit discussion.', 'Konfirmasi apakah pelanggan dapat melanjutkan pembahasan pra-kunjungan.')}</p>
              </div>
            </div>

            <div className={styles.question}>
              <label>{tx('Is the customer available?', 'Apakah pelanggan tersedia?')}</label>
              <div className={styles.choiceGrid}>
                <button type="button" className={form.customer_available === true ? styles.selected : ''} onClick={() => setBoolean('customer_available', true)}>{tx('Yes', 'Ya')}</button>
                <button type="button" className={form.customer_available === false ? styles.selected : ''} onClick={() => setBoolean('customer_available', false)}>{tx('No', 'Tidak')}</button>
              </div>
            </div>

            {form.customer_available === false && (
              <>
                <div className={styles.question}>
                  <label>{tx('Is the customer willing to reschedule?', 'Apakah pelanggan bersedia menjadwalkan ulang?')}</label>
                  <div className={styles.choiceGrid}>
                    <button type="button" className={form.willing_to_reschedule === true ? styles.selected : ''} onClick={() => setBoolean('willing_to_reschedule', true)}>{tx('Yes', 'Ya')}</button>
                    <button type="button" className={form.willing_to_reschedule === false ? styles.selected : ''} onClick={() => setBoolean('willing_to_reschedule', false)}>{tx('No', 'Tidak')}</button>
                  </div>
                </div>

                {form.willing_to_reschedule === true && (
                  <div className={styles.field}>
                    <label>{tx('Reschedule date & time (WIB)', 'Tanggal & waktu penjadwalan ulang (WIB)')}</label>
                    <input
                      type="datetime-local"
                      value={form.reschedule_date}
                      min={minDateTime || undefined}
                      step={300}
                      onChange={(e) => setForm((current) => ({ ...current, reschedule_date: e.target.value }))}
                    />
                    <small>{tx('Time is saved in Jakarta time (WIB).', 'Waktu disimpan menggunakan zona waktu Jakarta (WIB).')}</small>
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
                <h2>{tx('Address', 'Alamat')}</h2>
                <p>{tx('Validate the installation address before the field visit.', 'Validasi alamat instalasi sebelum kunjungan lapangan.')}</p>
              </div>
            </div>

            <div className={styles.question}>
              <label>{tx('Is the address confirmed?', 'Apakah alamat sudah dikonfirmasi?')}</label>
              <div className={styles.choiceGrid}>
                <button type="button" className={form.address_confirmed === true ? styles.selected : ''} onClick={() => setBoolean('address_confirmed', true)}>{tx('Yes', 'Ya')}</button>
                <button type="button" className={form.address_confirmed === false ? styles.selected : ''} onClick={() => setBoolean('address_confirmed', false)}>{tx('No', 'Tidak')}</button>
              </div>
            </div>

            {form.address_confirmed === false && (
              <div className={styles.field}>
                <label>{tx('Corrected / confirmed address', 'Alamat yang dikoreksi / dikonfirmasi')}</label>
                <textarea value={form.confirmed_address} onChange={(e) => setForm((current) => ({ ...current, confirmed_address: e.target.value }))} />
              </div>
            )}

            <div className={styles.field}>
              <label>{tx('Landmark / access note', 'Patokan / catatan akses')}</label>
              <textarea value={form.landmark} onChange={(e) => setForm((current) => ({ ...current, landmark: e.target.value }))} placeholder={tx('Nearest landmark or access note', 'Patokan terdekat atau catatan akses')} />
            </div>
          </section>
        )}

        {form.phone_contacted === true && form.customer_available === true && (
          <section className={styles.stepCard}>
            <div className={styles.stepTitle}>
              <span>4</span>
              <div>
                <h2>{tx('Appointment', 'Janji Kunjungan')}</h2>
                <p>{tx('Confirm the agreed visit date and time.', 'Konfirmasi tanggal dan waktu kunjungan yang telah disepakati.')}</p>
              </div>
            </div>

            <div className={styles.question}>
              <label>{tx('Does the customer want to make an appointment?', 'Apakah pelanggan ingin membuat janji kunjungan?')}</label>
              <div className={styles.choiceGrid}>
                <button type="button" className={form.wants_appointment === true ? styles.selected : ''} onClick={() => setBoolean('wants_appointment', true)}>{tx('Yes', 'Ya')}</button>
                <button type="button" className={form.wants_appointment === false ? styles.selected : ''} onClick={() => setBoolean('wants_appointment', false)}>{tx('No', 'Tidak')}</button>
              </div>
            </div>

            {form.wants_appointment === true && (
              <div className={styles.field}>
                <label>{tx('Visit date & time (WIB)', 'Tanggal & waktu kunjungan (WIB)')}</label>
                <input
                  type="datetime-local"
                  value={form.appointment_date}
                  min={minDateTime || undefined}
                  step={300}
                  onChange={(e) => setForm((current) => ({ ...current, appointment_date: e.target.value }))}
                />
                <small>{tx('Choose the agreed visit schedule in Jakarta time (WIB).', 'Pilih jadwal kunjungan yang disepakati dalam zona waktu Jakarta (WIB).')}</small>
              </div>
            )}
          </section>
        )}

        {form.phone_contacted === false && (
          <section className={styles.stepCard}>
            <div className={styles.stepTitle}>
              <span>2</span>
              <div>
                <h2>{tx('Direct Visit Decision', 'Keputusan Kunjungan Langsung')}</h2>
                <p>{tx('The phone could not be contacted.', 'Pelanggan tidak dapat dihubungi melalui telepon.')}</p>
              </div>
            </div>

            <div className={styles.question}>
              <label>{tx('Visit directly?', 'Kunjungi langsung?')}</label>
              <div className={styles.choiceGrid}>
                <button type="button" className={form.direct_visit === true ? styles.selected : ''} onClick={() => setBoolean('direct_visit', true)}>{tx('Yes', 'Ya')}</button>
                <button type="button" className={form.direct_visit === false ? styles.selected : ''} onClick={() => setBoolean('direct_visit', false)}>{tx('No', 'Tidak')}</button>
              </div>
            </div>

            {form.direct_visit === true && (
              <div className={styles.directVisitMap}>
                <div className={styles.mapHeader}>
                  <div>
                    <span>{tx('Customer location', 'Lokasi pelanggan')}</span>
                    <strong>{customer?.service_address || tx('Address not available', 'Alamat tidak tersedia')}</strong>
                  </div>
                  {hasCustomerCoordinates && <small>{customerLat.toFixed(6)}, {customerLng.toFixed(6)}</small>}
                </div>

                {customerMapEmbedUrl ? (
                  <iframe
                    title={`${tx('Map for', 'Peta untuk')} ${customer?.customer_name || tx('customer', 'pelanggan')}`}
                    src={customerMapEmbedUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <div className={styles.mapUnavailable}>{tx('Customer location is not available.', 'Lokasi pelanggan tidak tersedia.')}</div>
                )}

                {customerNavigationUrl && (
                  <a href={customerNavigationUrl} target="_blank" rel="noreferrer" className={styles.navigateButton}>
                    {tx('Open in Google Maps', 'Buka di Google Maps')}
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
              <h2>{tx('Closure', 'Penutupan')}</h2>
              <p>{tx('The status is calculated automatically from the answers above.', 'Status dihitung otomatis berdasarkan jawaban di atas.')}</p>
            </div>
          </div>

          <div className={styles.statusBox}>
            <span>{tx('Pre-Visit status', 'Status Pra-Kunjungan')}</span>
            <strong>{outcome.status}</strong>
            {outcome.reason && <small>{outcome.reason}</small>}
          </div>

          <div className={styles.field}>
            <label>{tx('Notes', 'Catatan')}</label>
            <textarea value={form.previsit_notes} onChange={(e) => setForm((current) => ({ ...current, previsit_notes: e.target.value }))} placeholder={tx('Optional additional notes', 'Catatan tambahan (opsional)')} />
          </div>
        </section>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submitButton} disabled={saving || outcome.status === 'Pending'}>
          {saving ? tx('Saving…', 'Menyimpan…') : tx('Save Pre-Visit', 'Simpan Pra-Kunjungan')}
        </button>
      </form>
    </main>
  )
}
