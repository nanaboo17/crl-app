import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'

export default async function AdminVisitDetailPage({
  params,
}: {
  params: Promise<{
    agentEmail: string
    date: string
    visitId: string
  }>
}) {
  const { agentEmail, date, visitId } = await params

  const decodedEmail = decodeURIComponent(agentEmail)
  const decodedVisitId = decodeURIComponent(visitId)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const currentEmail = user.email.trim().toLowerCase()

  const { data: currentUser } = await supabase
    .from('agents')
    .select('role, active')
    .eq('email', currentEmail)
    .maybeSingle()

  if (
    !currentUser ||
    !currentUser.active ||
    !['superadmin'].includes(currentUser.role)
  ) {
    redirect('/auth/route')
  }

  const { data: agent } = await supabase
    .from('agents')
    .select(`
      email,
      agent_name,
      sales_code
    `)
    .eq('email', decodedEmail)
    .maybeSingle()

  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .select('*')
    .eq('visit_id', decodedVisitId)
    .eq('agent_email', decodedEmail)
    .maybeSingle()

  if (visitError || !visit) {
    return (
      <main className={styles.page}>
        <Link
          href={`/superadmin/visits/${encodeURIComponent(
            decodedEmail
          )}/${date}`}
          className={styles.backButton}
        >
          ← Back
        </Link>

        <div className={styles.errorCard}>
          Visit not found.
        </div>
      </main>
    )
  }

  const { data: customer } = await supabase
    .from('customers')
    .select(`
      customer_id,
      customer_name,
      phone_number,
      service_address,
      city,
      district,
      sub_district,
      given_latitude,
      given_longitude,
      payment_status,
      visit_status
    `)
    .eq('customer_id', visit.customer_id)
    .maybeSingle()

  let photoUrl: string | null = null

  if (visit.visit_photo_url) {
    const { data } = await supabase.storage
      .from('visit-evidence')
      .createSignedUrl(
        visit.visit_photo_url,
        60 * 10
      )

    photoUrl = data?.signedUrl ?? null
  }

  function formatDateTime(value: string | null) {
    if (!value) return '-'

    return new Date(value).toLocaleString(
      'id-ID'
    )
  }

  function formatDate(value: string | null) {
    if (!value) return '-'

    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString(
      'id-ID'
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href={`/superadmin/visits/${encodeURIComponent(
            decodedEmail
          )}/${date}`}
          className={styles.backButton}
        >
          ← Back
        </Link>

        <div>
          <p className={styles.eyebrow}>
            VISIT DETAIL
          </p>

          <h1>
            {customer?.customer_name ||
              visit.customer_id}
          </h1>

          <p>
            {visit.visit_id}
          </p>
        </div>
      </header>

      <section className={styles.topGrid}>
        <div className={styles.statusCard}>
          <span>Visit Status</span>
          <strong>
            {visit.visit_status_kunjungan || '-'}
          </strong>
        </div>

        <div className={styles.statusCard}>
          <span>Payment</span>
          <strong>
            {customer?.payment_status
              ? customer.payment_status.toUpperCase()
              : '-'}
          </strong>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Agent</h2>

        <div className={styles.grid}>
          <Detail
            label="Agent Name"
            value={agent?.agent_name}
          />

          <Detail
            label="Sales Code"
            value={agent?.sales_code}
          />

          <Detail
            label="Agent Email"
            value={decodedEmail}
            full
          />
        </div>
      </section>

      <section className={styles.card}>
        <h2>Customer</h2>

        <div className={styles.grid}>
          <Detail
            label="Customer ID"
            value={customer?.customer_id}
          />

          <Detail
            label="Customer Name"
            value={customer?.customer_name}
          />

          <Detail
            label="Phone"
            value={customer?.phone_number}
          />

          <Detail
            label="Updated Phone"
            value={visit.updated_phone}
          />

          <Detail
            label="Area"
            value={
              customer?.sub_district ||
              customer?.district ||
              customer?.city
            }
          />

          <Detail
            label="Customer Address"
            value={customer?.service_address}
            full
          />
        </div>
      </section>

      <section className={styles.card}>
        <h2>Visit Result</h2>

        <div className={styles.grid}>
          <Detail
            label="Visit Date"
            value={formatDateTime(
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
            full
          />

          <Detail
            label="Offer Disetujui"
            value={visit.approved_offer}
            full
          />

          <Detail
            label="Promise to Pay Date"
            value={formatDate(
              visit.planned_payment_date
            )}
          />

          <Detail
            label="Alasan Belum Bayar"
            value={visit.unpaid_reason}
          />

          <Detail
            label="Consent"
            value={
              visit.consent_given
                ? '✓ Given'
                : 'Not Given'
            }
          />

          <Detail
            label="Visit Status Customer"
            value={customer?.visit_status}
          />
        </div>
      </section>

      <section className={styles.card}>
        <h2>GPS Verification</h2>

        <div className={styles.grid}>
          <Detail
            label="Given Latitude"
            value={
              customer?.given_latitude
            }
          />

          <Detail
            label="Given Longitude"
            value={
              customer?.given_longitude
            }
          />

          <Detail
            label="Visit Latitude"
            value={visit.latitude}
          />

          <Detail
            label="Visit Longitude"
            value={visit.longitude}
          />

          <Detail
            label="Accuracy"
            value={
              visit.gps_accuracy !== null
                ? `${Number(
                    visit.gps_accuracy
                  ).toFixed(1)} meters`
                : '-'
            }
          />

          <Detail
            label="Captured At"
            value={formatDateTime(
              visit.gps_captured_at
            )}
          />

          <Detail
            label="Distance"
            value={
              visit.distance_to_customer_meters !== null
                ? `${Number(
                    visit.distance_to_customer_meters
                  ).toFixed(1)} meters`
                : '-'
            }
          />

          <Detail
            label="Location Result"
            value={
              visit.location_match === true
                ? '✓ Match'
                : visit.location_match === false
                  ? '⚠ Outside Range'
                  : 'Not Available'
            }
          />
        </div>

        {visit.latitude &&
          visit.longitude && (
            <div className={styles.mapBox}>
              <iframe
                title="Visit Pinpoint"
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
            className={styles.photo}
          />
        ) : (
          <div className={styles.noPhoto}>
            Photo unavailable.
          </div>
        )}
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