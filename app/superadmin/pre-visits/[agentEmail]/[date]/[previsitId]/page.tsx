import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'

export default async function AdminPreVisitDetailPage({
  params,
}: {
  params: Promise<{
    agentEmail: string
    date: string
    previsitId: string
  }>
}) {
  const {
    agentEmail,
    date,
    previsitId,
  } = await params

  const decodedEmail =
    decodeURIComponent(agentEmail)

  const decodedPrevisitId =
    decodeURIComponent(previsitId)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const currentEmail =
    user.email.trim().toLowerCase()

  const { data: currentUser } =
    await supabase
      .from('agents')
      .select('role, active')
      .eq('email', currentEmail)
      .maybeSingle()

  if (
    !currentUser ||
    !currentUser.active ||
    !['admin', 'superadmin'].includes(
      currentUser.role
    )
  ) {
    redirect('/auth/route')
  }

  const { data: agent } =
    await supabase
      .from('agents')
      .select(`
        email,
        agent_name,
        sales_code
      `)
      .eq('email', decodedEmail)
      .maybeSingle()

  const {
    data: preVisit,
    error: preVisitError,
  } = await supabase
    .from('pre_visits')
    .select('*')
    .eq(
      'previsit_id',
      decodedPrevisitId
    )
    .eq(
      'agent_email',
      decodedEmail
    )
    .maybeSingle()

  if (
    preVisitError ||
    !preVisit
  ) {
    return (
      <main className={styles.page}>
        <Link
          href={`/superadmin/pre-visits/${encodeURIComponent(
            decodedEmail
          )}/${date}`}
          className={
            styles.backButton
          }
        >
          ← Back
        </Link>

        <div
          className={
            styles.errorCard
          }
        >
          Pre-Visit not found.
        </div>
      </main>
    )
  }

  const { data: customer } =
    await supabase
      .from('customers')
      .select(`
        customer_id,
        customer_name,
        phone_number,
        alternative_phone_1,
        alternative_phone_2,
        alternative_phone_3,
        service_address,
        region,
        city,
        district,
        sub_district,
        customer_status,
        visit_status
      `)
      .eq(
        'customer_id',
        preVisit.customer_id
      )
      .maybeSingle()

  function formatDateTime(
    value: string | null
  ) {
    if (!value) return '-'

    return new Date(
      value
    ).toLocaleString('id-ID')
  }

  return (
    <main className={styles.page}>
      <header
        className={
          styles.header
        }
      >
        <Link
          href={`/superadmin/pre-visits/${encodeURIComponent(
            decodedEmail
          )}/${date}`}
          className={
            styles.backButton
          }
        >
          ← Back
        </Link>

        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            PRE-VISIT DETAIL
          </p>

          <h1>
            {customer?.customer_name ||
              preVisit.customer_id}
          </h1>

          <p>
            {preVisit.previsit_id}
          </p>
        </div>
      </header>

      <section
        className={
          styles.topGrid
        }
      >
        <div
          className={
            styles.statusCard
          }
        >
          <span>
            Pre-Visit Status
          </span>

          <strong>
            {preVisit.previsit_status}
          </strong>
        </div>

        <div
          className={
            styles.statusCard
          }
        >
          <span>
            Contact Result
          </span>

          <strong>
            {preVisit.contact_result ||
              '-'}
          </strong>
        </div>
      </section>

      <section
        className={
          styles.card
        }
      >
        <h2>
          Agent
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label="Agent Name"
            value={
              agent?.agent_name
            }
          />

          <Detail
            label="Sales Code"
            value={
              agent?.sales_code
            }
          />

          <Detail
            label="Agent Email"
            value={
              decodedEmail
            }
            full
          />
        </div>
      </section>

      <section
        className={
          styles.card
        }
      >
        <h2>
          Customer
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label="Customer ID"
            value={
              customer?.customer_id
            }
          />

          <Detail
            label="Customer Name"
            value={
              customer?.customer_name
            }
          />

          <Detail
            label="Main Phone"
            value={
              customer?.phone_number
            }
          />

          <Detail
            label="Alternative Phone 1"
            value={
              customer?.alternative_phone_1
            }
          />

          <Detail
            label="Alternative Phone 2"
            value={
              customer?.alternative_phone_2
            }
          />

          <Detail
            label="Alternative Phone 3"
            value={
              customer?.alternative_phone_3
            }
          />

          <Detail
            label="Region"
            value={
              customer?.region
            }
          />

          <Detail
            label="City"
            value={
              customer?.city
            }
          />

          <Detail
            label="District"
            value={
              customer?.district
            }
          />

          <Detail
            label="Sub-District"
            value={
              customer?.sub_district
            }
          />

          <Detail
            label="Service Address"
            value={
              customer?.service_address
            }
            full
          />
        </div>
      </section>

      <section
        className={
          styles.card
        }
      >
        <h2>
          Contact Confirmation
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label="Contact Attempt"
            value={formatDateTime(
              preVisit.contact_attempt_date
            )}
          />

          <Detail
            label="Contact Confirmed"
            value={
              preVisit.contact_confirmed
                ? '✓ Yes'
                : 'No'
            }
          />

          <Detail
            label="Contact Result"
            value={
              preVisit.contact_result
            }
            full
          />
        </div>
      </section>

      <section
        className={
          styles.card
        }
      >
        <h2>
          Address Confirmation
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label="Address Confirmed"
            value={
              preVisit.address_confirmed
                ? '✓ Yes'
                : 'No'
            }
          />

          <Detail
            label="Landmark"
            value={
              preVisit.landmark
            }
          />

          <Detail
            label="Confirmed Address"
            value={
              preVisit.confirmed_address
            }
            full
          />
        </div>
      </section>

      <section
        className={
          styles.card
        }
      >
        <h2>
          Appointment
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label="Appointment Confirmed"
            value={
              preVisit.appointment_confirmed
                ? '✓ Yes'
                : 'No'
            }
          />

          <Detail
            label="Appointment Date"
            value={formatDateTime(
              preVisit.appointment_date
            )}
          />
        </div>
      </section>

      <section
        className={
          styles.card
        }
      >
        <h2>
          Supervisor
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label="Supervisor Approval"
            value={
              preVisit.supervisor_approval
                ? '✓ Approved'
                : 'Not Approved'
            }
          />

          <Detail
            label="Created At"
            value={formatDateTime(
              preVisit.created_at
            )}
          />
        </div>
      </section>

      <section
        className={
          styles.card
        }
      >
        <h2>
          Pre-Visit Notes
        </h2>

        <p
          className={
            styles.notes
          }
        >
          {preVisit.previsit_notes ||
            'No notes.'}
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
      <span>
        {label}
      </span>

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