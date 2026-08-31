'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'

const LOCATION_LIMIT_METERS = 200

export default function VisitPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const customerId = decodeURIComponent(
    params.customerId as string
  )

  const [customer, setCustomer] = useState<any>(null)
  const [agent, setAgent] = useState<any>(null)

  const [updatedPhone, setUpdatedPhone] = useState('')
  const [visitAddress, setVisitAddress] = useState('')

  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsCapturedAt, setGpsCapturedAt] = useState<string | null>(null)

  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)
  const [locationMatch, setLocationMatch] = useState<boolean | null>(null)

  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [stampedPhoto, setStampedPhoto] = useState<Blob | null>(null)

  const [consentGiven, setConsentGiven] = useState(false)

  const [loading, setLoading] = useState(true)
  const [gettingGps, setGettingGps] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [visitStatusKunjungan, setVisitStatusKunjungan] = useState('')
  const [conversationResult, setConversationResult] = useState('')
const [approvedOffer, setApprovedOffer] = useState('')
const [plannedPaymentDate, setPlannedPaymentDate] = useState('')
const [unpaidReason, setUnpaidReason] = useState('')
const [additionalNotes, setAdditionalNotes] = useState('')
useEffect(() => {
  if (conversationResult === 'Sudah melakukan pembayaran') {
    setUnpaidReason('Sudah bayar')
    setPlannedPaymentDate('')
  }

  if (conversationResult === 'Tidak bertemu pelanggan') {
    setApprovedOffer('Belum ada offer yang disetujui')
    setPlannedPaymentDate('')
  }
}, [conversationResult])

  useEffect(() => {
    async function loadPage() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.email) {
        router.replace('/login')
        return
      }

      const email = user.email.trim().toLowerCase()

      const { data: agentData } = await supabase
        .from('agents')
        .select('email, agent_name, sales_code, role, active')
        .eq('email', email)
        .maybeSingle()

      if (
        !agentData ||
        !agentData.active ||
        agentData.role !== 'agent'
      ) {
        router.replace('/auth/route')
        return
      }

      const { data: customerData, error: customerError } =
        await supabase
          .from('customers')
          .select(`
            *,
            given_latitude,
            given_longitude
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

      const { data: preVisit } = await supabase
        .from('pre_visits')
        .select('previsit_status')
        .eq('customer_id', customerId)
        .eq('agent_email', email)
        .maybeSingle()

      if (!preVisit || preVisit.previsit_status !== 'Ready for Visit') {
        setError(
          'Pre-Visit must be Ready for Visit before starting a visit.'
        )
        setLoading(false)
        return
      }

      const { data: existingVisit } = await supabase
        .from('visits')
        .select('visit_id')
        .eq('customer_id', customerId)
        .maybeSingle()

      if (existingVisit) {
        setError(
          'A visit has already been submitted for this customer.'
        )
        setLoading(false)
        return
      }

      setAgent(agentData)
      setCustomer(customerData)
      setUpdatedPhone(customerData.phone_number ?? '')
      setVisitAddress(customerData.service_address ?? '')

      setLoading(false)
    }

    loadPage()
  }, [customerId])

  function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {
    const R = 6371000

    const toRad = (value: number) =>
      (value * Math.PI) / 180

    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )

    return R * c
  }

  function captureGps() {
    if (latitude !== null || longitude !== null) {
      return
    }

    setError('')

    if (!navigator.geolocation) {
      setError('GPS is not supported on this device.')
      return
    }

    setGettingGps(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLat = position.coords.latitude
        const currentLong = position.coords.longitude

        setLatitude(currentLat)
        setLongitude(currentLong)
        setGpsAccuracy(position.coords.accuracy)

        const capturedAt = new Date().toISOString()

        setGpsCapturedAt(capturedAt)

        if (
          customer?.given_latitude !== null &&
          customer?.given_latitude !== undefined &&
          customer?.given_longitude !== null &&
          customer?.given_longitude !== undefined
        ) {
          const distance = haversineDistance(
            Number(customer.given_latitude),
            Number(customer.given_longitude),
            currentLat,
            currentLong
          )

          setDistanceMeters(distance)
          setLocationMatch(
            distance <= LOCATION_LIMIT_METERS
          )
        }

        setGettingGps(false)
      },

      (gpsError) => {
        setError(
          `Unable to get GPS: ${gpsError.message}`
        )

        setGettingGps(false)
      },

      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    )
  }

  async function stampImage(file: File) {
    if (
      latitude === null ||
      longitude === null ||
      !gpsCapturedAt
    ) {
      throw new Error(
        'GPS must be captured before taking the photo.'
      )
    }

    return new Promise<Blob>((resolve, reject) => {
      const image = new Image()

      image.onload = () => {
        const canvas =
          document.createElement('canvas')

        canvas.width = image.width
        canvas.height = image.height

        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(
            new Error('Unable to process photo.')
          )
          return
        }

        ctx.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        )

        const fontSize = Math.max(
          26,
          Math.round(canvas.width * 0.028)
        )

        const padding = Math.max(
          20,
          Math.round(canvas.width * 0.02)
        )

        const lineHeight = fontSize * 1.35
        const overlayHeight =
          lineHeight * 4 + padding * 2

        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'

        ctx.fillRect(
          0,
          canvas.height - overlayHeight,
          canvas.width,
          overlayHeight
        )

        ctx.fillStyle = '#ffffff'
        ctx.font = `600 ${fontSize}px Arial`

        const timestamp =
          new Date(
            gpsCapturedAt
          ).toLocaleString('id-ID')

        const lines = [
          `Latitude: ${latitude.toFixed(7)}`,
          `Longitude: ${longitude.toFixed(7)}`,
          `Timestamp: ${timestamp}`,
          `Customer ID: ${customerId}`,
        ]

        lines.forEach((line, index) => {
          ctx.fillText(
            line,
            padding,
            canvas.height -
              overlayHeight +
              padding +
              lineHeight * (index + 1)
          )
        })

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  'Unable to create stamped photo.'
                )
              )
              return
            }

            resolve(blob)
          },
          'image/jpeg',
          0.88
        )
      }

      image.onerror = () => {
        reject(
          new Error('Unable to load photo.')
        )
      }

      image.src = URL.createObjectURL(file)
    })
  }

  async function handlePhoto(
    selectedFile: File | null
  ) {
    if (!selectedFile) {
      return
    }

    if (
      latitude === null ||
      longitude === null ||
      !gpsCapturedAt
    ) {
      setError(
        'Capture GPS first before taking the visit photo.'
      )
      return
    }

    setError('')

    try {
      const stamped = await stampImage(
        selectedFile
      )

      setPhoto(selectedFile)
      setStampedPhoto(stamped)

      const previewUrl =
        URL.createObjectURL(stamped)

      setPhotoPreview(previewUrl)
    } catch (err: any) {
      setError(
        err.message ||
          'Unable to process the photo.'
      )
    }
  }

  async function submitVisit() {
    setError('')

    if (
      latitude === null ||
      longitude === null ||
      !gpsCapturedAt
    ) {
      setError(
        'Please capture GPS before submitting.'
      )
      return
    }

  if (!visitStatusKunjungan) {
  setError('Please select Status Kunjungan.')
  return
}

if (!conversationResult) {
  setError('Please select Hasil Pembicaraan dengan Pelanggan.')
  return
}

if (
  conversationResult !== 'Tidak bertemu pelanggan' &&
  !approvedOffer
) {
  setError('Please select Offer yang Disetujui.')
  return
}

if (
  conversationResult === 'Bersedia bayar / Promise to Pay' &&
  !plannedPaymentDate
) {
  setError('Please enter Rencana Tanggal Pembayaran.')
  return
}

if (
  conversationResult !== 'Sudah melakukan pembayaran' &&
  !unpaidReason
) {
  setError('Please select alasan pembayaran.')
  return
}
    if (!photo || !stampedPhoto) {
      setError(
        'Please take the visit photo.'
      )
      return
    }

    if (!consentGiven) {
      setError(
        'Customer consent is required.'
      )
      return
    }

    setSaving(true)

    const safeCustomerId =
      customerId.replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      )

    const filePath =
      `${agent.email}/${safeCustomerId}/${Date.now()}-stamped.jpg`

    const { error: uploadError } =
      await supabase.storage
        .from('visit-evidence')
        .upload(
          filePath,
          stampedPhoto,
          {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false,
          }
        )

    if (uploadError) {
      setError(
        `Photo upload failed: ${uploadError.message}`
      )

      setSaving(false)
      return
    }

    const { error: visitError } =
      await supabase
        .from('visits')
        .insert({
          customer_id: customerId,
          agent_email: agent.email,
          sales_code: agent.sales_code,
          visit_result: conversationResult,

          customer_phone:
            customer.phone_number,

          updated_phone:
            updatedPhone.trim() || null,

          visit_address:
            visitAddress.trim() || null,

          latitude,
          longitude,
          gps_accuracy: gpsAccuracy,
          gps_captured_at: gpsCapturedAt,

          distance_to_customer_meters:
            distanceMeters,

          location_match:
            locationMatch,

          visit_photo_url:
            filePath,

          consent_given:
            consentGiven,
            visit_status_kunjungan: visitStatusKunjungan,

conversation_result: conversationResult,

approved_offer: approvedOffer,

planned_payment_date:
  plannedPaymentDate || null,

unpaid_reason: unpaidReason,

additional_notes:
  additionalNotes.trim() || null,
        })

    if (visitError) {
      await supabase.storage
        .from('visit-evidence')
        .remove([filePath])

      setError(visitError.message)
      setSaving(false)
      return
    }

    const nextPaymentStatus =
  conversationResult === 'Sudah melakukan pembayaran'
    ? 'paid'
    : 'unpaid'

const { error: customerUpdateError } = await supabase
  .from('customers')
  .update({
    visit_status: 'Visited',
    customer_status: '5. Visited',
    payment_status: nextPaymentStatus,
  })
  .eq('customer_id', customerId)

if (customerUpdateError) {
  setError(
    `Visit saved, but customer update failed: ${customerUpdateError.message}`
  )
  setSaving(false)
  return
}

   router.replace(
  `/agent/customers/${encodeURIComponent(
    customerId
  )}`
)

router.refresh()
  }

  if (loading) {
    return (
      <main className={styles.page}>
        Loading visit...
      </main>
    )
  }

  if (!customer || !agent) {
    return (
      <main className={styles.page}>
        <button
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

        <div className={styles.errorCard}>
          {error || 'Unable to start visit.'}
        </div>
      </main>
    )
  }

  const gpsCaptured =
    latitude !== null &&
    longitude !== null

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
          FIELD VISIT
        </p>

        <h1>Customer Visit</h1>
      </header>

      <section className={styles.customerCard}>
        <span>Customer</span>

        <h2>{customer.customer_name}</h2>

        <p>{customer.customer_id}</p>
      </section>

      <section className={styles.card}>
        <h2>1. Visit Location</h2>

        <label>
          Customer Address

          <textarea
            value={visitAddress}
            onChange={(e) =>
              setVisitAddress(
                e.target.value
              )
            }
          />
        </label>

        <div className={styles.givenLocation}>
          <div>
            <span>
              Given Latitude
            </span>

            <strong>
              {customer.given_latitude ??
                'Not set'}
            </strong>
          </div>

          <div>
            <span>
              Given Longitude
            </span>

            <strong>
              {customer.given_longitude ??
                'Not set'}
            </strong>
          </div>
        </div>

        {!gpsCaptured && (
          <button
            type="button"
            className={styles.gpsButton}
            onClick={captureGps}
            disabled={gettingGps}
          >
            {gettingGps
              ? 'Capturing GPS...'
              : 'Capture GPS'}
          </button>
        )}

        {gpsCaptured && (
          <>
            <div className={styles.gpsSuccess}>
              ✓ GPS captured
            </div>

            <div className={styles.gpsResult}>
              <div>
                <span>
                  Visit Latitude
                </span>

                <strong>
                  {latitude?.toFixed(7)}
                </strong>
              </div>

              <div>
                <span>
                  Visit Longitude
                </span>

                <strong>
                  {longitude?.toFixed(7)}
                </strong>
              </div>

              <div>
                <span>
                  Accuracy
                </span>

                <strong>
                  {gpsAccuracy !== null
                    ? `${gpsAccuracy.toFixed(
                        1
                      )} meters`
                    : '-'}
                </strong>
              </div>

              <div>
                <span>
                  Captured At
                </span>

                <strong>
                  {gpsCapturedAt
                    ? new Date(
                        gpsCapturedAt
                      ).toLocaleString(
                        'id-ID'
                      )
                    : '-'}
                </strong>
              </div>
            </div>

            {distanceMeters !== null && (
              <div
                className={
                  locationMatch
                    ? styles.locationMatch
                    : styles.locationMismatch
                }
              >
                <span>
                  Distance from Given Address
                </span>

                <strong>
                  {distanceMeters.toFixed(
                    1
                  )}{' '}
                  meters
                </strong>

                <p>
                  {locationMatch
                    ? '✓ Location matches customer address'
                    : '⚠ Visit location is outside the allowed range'}
                </p>
              </div>
            )}

            <div className={styles.mapBox}>
              <iframe
                title="Visit Pinpoint"
                src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=17&output=embed`}
                loading="lazy"
              />
            </div>

            <a
              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
              target="_blank"
              rel="noreferrer"
              className={styles.mapButton}
            >
              Open Pinpoint in Maps
            </a>
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2>2. Customer Contact</h2>

        <label>
          Current Phone

          <input
            value={
              customer.phone_number ?? ''
            }
            disabled
          />
        </label>

        <label>
          Updated Phone

          <input
            type="tel"
            value={updatedPhone}
            onChange={(e) =>
              setUpdatedPhone(
                e.target.value
              )
            }
          />
        </label>
      </section>

      <section className={styles.card}>
        <h2>3. Visit Photo</h2>

        {!gpsCaptured && (
          <div className={styles.warningBox}>
            Capture GPS first. The photo
            will automatically include
            latitude, longitude, timestamp,
            and customer ID.
          </div>
        )}

        <label>
          Take Visit Photo

          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={!gpsCaptured}
            onChange={(e) =>
              handlePhoto(
                e.target.files?.[0] ??
                  null
              )
            }
          />
        </label>

        {photoPreview && (
          <div
            className={
              styles.photoPreview
            }
          >
            <img
              src={photoPreview}
              alt="Stamped visit evidence"
            />

            <span>
              ✓ GPS & timestamp stamped
            </span>
          </div>
        )}

        <label
          className={
            styles.checkboxRow
          }
        >
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) =>
              setConsentGiven(
                e.target.checked
              )
            }
          />

          <span>
            Customer / authorized person
            has given consent for account
            discussion and visit evidence.
          </span>
        </label>
      </section>

      <section className={styles.card}>
  <h2>4. Hasil Kunjungan</h2>

  <label>
    Status Kunjungan *

    <select
      value={visitStatusKunjungan}
      onChange={(e) =>
        setVisitStatusKunjungan(e.target.value)
      }
    >
      <option value="">
        Pilih Status Kunjungan
      </option>

      <option value="Bertemu dengan pelanggan">
        Bertemu dengan pelanggan
      </option>

      <option value="Pelanggan tidak ada di tempat">
        Pelanggan tidak ada di tempat
      </option>

      <option value="Alamat tidak ditemukan">
        Alamat tidak ditemukan
      </option>

      <option value="Pelanggan sudah pindah">
        Pelanggan sudah pindah
      </option>

      <option value="Tidak berhasil dikunjungi">
        Tidak berhasil dikunjungi
      </option>

      <option value="Lainnya">
        Lainnya
      </option>
    </select>
  </label>

  <label>
    Hasil Pembicaraan dengan Pelanggan *

    <select
      value={conversationResult}
      onChange={(e) =>
        setConversationResult(e.target.value)
      }
    >
      <option value="">
        Pilih Hasil Pembicaraan
      </option>

      <option value="Sudah melakukan pembayaran">
        Sudah melakukan pembayaran
      </option>

      <option value="Bersedia bayar / Promise to Pay">
        Bersedia bayar / Promise to Pay
      </option>

      <option value="Masih mempertimbangkan">
        Masih mempertimbangkan
      </option>

      <option value="Tidak bersedia melanjutkan layanan">
        Tidak bersedia melanjutkan layanan
      </option>

      <option value="Tidak bertemu pelanggan">
        Tidak bertemu pelanggan
      </option>
    </select>
  </label>
</section>

{conversationResult !== 'Tidak bertemu pelanggan' && (
  <section className={styles.card}>
    <h2>5. Offer</h2>

    <p className={styles.helperText}>
      Pilih sesuai offer yang benar-benar sudah
      disampaikan dan disetujui pelanggan.
    </p>

    <label>
      Offer yang Disetujui dengan Pelanggan *

      <select
        value={approvedOffer}
        onChange={(e) =>
          setApprovedOffer(e.target.value)
        }
      >
        <option value="">
          Pilih Offer
        </option>

        <option value="Diskon 20% selama 3 bulan + Voucher Rp100.000">
          Diskon 20% selama 3 bulan + Voucher Rp100.000
        </option>

        <option value="Diskon 30% selama 3 bulan + Voucher Rp100.000">
          Diskon 30% selama 3 bulan + Voucher Rp100.000
        </option>

        <option value="Diskon 30% selama 3 bulan + Voucher Rp200.000">
          Diskon 30% selama 3 bulan + Voucher Rp200.000
        </option>

        <option value="Belum ada offer yang disetujui">
          Belum ada offer yang disetujui
        </option>
      </select>
    </label>
  </section>
)}

<section className={styles.card}>
  <h2>6. Pembayaran</h2>

  {conversationResult ===
    'Bersedia bayar / Promise to Pay' && (
    <label>
      Rencana Tanggal Pembayaran *

      <input
        type="date"
        value={plannedPaymentDate}
        onChange={(e) =>
          setPlannedPaymentDate(e.target.value)
        }
      />
    </label>
  )}

  {conversationResult ===
    'Sudah melakukan pembayaran' ? (
    <div className={styles.autoStatus}>
      <span>Status</span>
      <strong>Sudah bayar</strong>
    </div>
  ) : conversationResult !==
    'Tidak bertemu pelanggan' ? (
    <label>
      Jika Belum Bayar, Apa Alasan Utamanya? *

      <select
        value={unpaidReason}
        onChange={(e) =>
          setUnpaidReason(e.target.value)
        }
      >
        <option value="">
          Pilih Alasan
        </option>

        <option value="Masalah keuangan">
          Masalah keuangan
        </option>

        <option value="Harga / tagihan">
          Harga / tagihan
        </option>

        <option value="Pindah ke provider lain">
          Pindah ke provider lain
        </option>

        <option value="Masalah jaringan / layanan">
          Masalah jaringan / layanan
        </option>

        <option value="Jarang digunakan">
          Jarang digunakan
        </option>

        <option value="Pindah alamat">
          Pindah alamat
        </option>

        <option value="Masalah sales">
          Masalah sales
        </option>

        <option value="Alasan pribadi">
          Alasan pribadi
        </option>

        <option value="Lainnya">
          Lainnya
        </option>
      </select>
    </label>
  ) : (
    <div className={styles.autoStatus}>
      <span>Status</span>
      <strong>Tidak bertemu pelanggan</strong>
    </div>
  )}
</section>

<section className={styles.card}>
  <h2>7. Catatan Tambahan</h2>

  <p className={styles.helperText}>
    Optional. Isi jika ada informasi penting
    dari pelanggan, seperti update data pelanggan
    atau kendala layanan.
  </p>

  <label>
    Catatan Tambahan

    <textarea
      value={additionalNotes}
      onChange={(e) =>
        setAdditionalNotes(e.target.value)
      }
      placeholder="Contoh: nomor telepon baru, kendala jaringan, update alamat..."
    />
  </label>
</section>

      {error && (
        <div className={styles.errorCard}>
          {error}
        </div>
      )}

      <button
        type="button"
        className={styles.submitButton}
        disabled={saving}
        onClick={submitVisit}
      >
        {saving
          ? 'Submitting Visit...'
          : 'Submit Visit'}
      </button>
    </main>
  )
}