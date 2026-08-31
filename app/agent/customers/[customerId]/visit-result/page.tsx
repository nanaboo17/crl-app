import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'

export default async function VisitResultPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params

  const decodedCustomerId =
    decodeURIComponent(customerId)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const email =
    user.email.trim().toLowerCase()

  const { data: customer } =
    await supabase
      .from('customers')
      .select(`
        customer_id,
        customer_name,
        phone_number,
        service_address,
        agent_email,
        payment_status,
        visit_status
      `)
      .eq(
        'customer_id',
        decodedCustomerId
      )
      .eq('agent_email', email)
      .maybeSingle()

  if (!customer) {
    return (
      <main className={styles.page}>
        <div className={styles.errorCard}>
          Customer not found.
        </div>
      </main>
    )
  }

  const { data: visit, error } =
    await supabase
      .from('visits')
      .select('*')
      .eq(
        'customer_id',
        decodedCustomerId
      )
      .eq('agent_email', email)
      .maybeSingle()

  if (error || !visit) {
    return (
      <main className={styles.page}>
        <Link
          href={`/agent/customers/${encodeURIComponent(
            decodedCustomerId
          )}`}
          className={styles.backButton}
        >
          ← Back
        </Link>

        <div className={styles.errorCard}>
          Visit result not found.
        </div>
      </main>
    )
  }

  let photoUrl: string | null = null

  if (visit.visit_photo_url) {
    const { data } =
      await supabase.storage
        .from('visit-evidence')
        .createSignedUrl(
          visit.visit_photo_url,
          60 * 10
        )

    photoUrl =
      data?.signedUrl ?? null
  }

  function formatDate(
    value: string | null
  ) {
    if (!value) return '-'

    return new Date(
      value
    ).toLocaleString('id-ID')
  }

  function formatPaymentDate(
    value: string | null
  ) {
    if (!value) return '-'

    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString('id-ID')
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href={`/agent/customers/${encodeURIComponent(
            decodedCustomerId
          )}`}
          className={styles.backButton}
        >
          ← Back
        </Link>

        <div>
          <p className={styles.eyebrow}>
            VISIT RESULT
          </p>

          <h1>
            {customer.customer_name}
          </h1>

          <p>
            {customer.customer_id}
          </p>
        </div>
      </header>

      <section className={styles.statusCard}>
        <span>Visit Status</span>
        <strong>✓ Visited</strong>
      </section>

      <section className={styles.card}>
        <h2>Visit Information</h2>

        <div className={styles.grid}>
          <Detail
            label="Visit ID"
            value={visit.visit_id}
          />

          <Detail
            label="Visit Date"
            value={formatDate(
              visit.visit_date
            )}
          />

          <Detail
            label="Status Kunjungan"
            value={
              visit.visit_status_kunjungan
            }
          />

          <Detail
            label="Hasil Pembicaraan"
            value={
              visit.conversation_result
            }
          />
        </div>
      </section>

      <section className={styles.card}>
        <h2>Location Evidence</h2>

        <div className={styles.grid}>
          <Detail
            label="Latitude"
            value={visit.latitude}
          />

          <Detail
            label="Longitude"
            value={visit.longitude}
          />

          <Detail
            label="GPS Accuracy"
            value={
              visit.gps_accuracy
                ? `${Number(
                    visit.gps_accuracy
                  ).toFixed(1)} meters`
                : '-'
            }
          />

          <Detail
            label="GPS Captured"
            value={formatDate(
              visit.gps_captured_at
            )}
          />

          <Detail
            label="Distance from Customer Location"
            value={
              visit.distance_to_customer_meters !==
              null
                ? `${Number(
                    visit.distance_to_customer_meters
                  ).toFixed(1)} meters`
                : '-'
            }
          />

          <Detail
            label="Location Match"
            value={
              visit.location_match === true
                ? '✓ Match'
                : visit.location_match === false
                  ? 'Outside Range'
                  : 'Not Available'
            }
          />

          <Detail
            label="Visit Address"
            value={visit.visit_address}
            full
          />
        </div>

        {visit.latitude &&
          visit.longitude && (
            <div className={styles.mapBox}>
              <iframe
                title="Visit Location"
                src={`https://maps.google.com/maps?q=${visit.latitude},${visit.longitude}&z=17&output=embed`}
                loading="lazy"
              />
            </div>
          )}
      </section>

      <section className={styles.card}>
        <h2>Visit Photo</h2>

        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Visit Evidence"
            className={styles.visitPhoto}
          />
        ) : (
          <p className={styles.noPhoto}>
            Photo unavailable.
          </p>
        )}
      </section>

      <section className={styles.card}>
        <h2>Customer Response</h2>

        <div className={styles.grid}>
          <Detail
            label="Offer Disetujui"
            value={visit.approved_offer}
            full
          />

          <Detail
            label="Rencana Tanggal Pembayaran"
            value={formatPaymentDate(
              visit.planned_payment_date
            )}
          />

          <Detail
            label="Alasan Belum Bayar"
            value={visit.unpaid_reason}
          />

          <Detail
            label="Payment Status"
            value={
              customer.payment_status
                ? customer.payment_status.toUpperCase()
                : '-'
            }
          />

          <Detail
            label="Updated Phone"
            value={visit.updated_phone}
          />

          <Detail
            label="Consent"
            value={
              visit.consent_given
                ? '✓ Given'
                : 'Not Given'
            }
          />
        </div>
      </section>

      <section className={styles.card}>
        <h2>Catatan Tambahan</h2>

        <p className={styles.notes}>
          {visit.additional_notes ||
            'Tidak ada catatan tambahan.'}
        </p>
      </section>
    </main>
  )
}

function Detail({
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
          ? `${styles.detail} ${styles.full}`
          : styles.detail
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