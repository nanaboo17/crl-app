import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

const PREVISIT_STATUS_KEYS: Record<string, string> = {
  'ready for visit': 'superadmin.status.readyForVisit',
  'need follow-up': 'superadmin.status.needFollowup',
  'supervisor review': 'superadmin.status.supervisorReview',
}

function previsitStatusKey(value: string | null | undefined): string | null {
  if (!value) return null
  return PREVISIT_STATUS_KEYS[value.toLowerCase()] ?? null
}

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

  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, allMessages, key, params)

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
          {t('superadmin.preVisits.detail.notFound')}
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
          {t('superadmin.preVisits.detail.back')}
        </Link>

        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            {t('superadmin.preVisits.detail.eyebrow')}
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
            {t('superadmin.preVisits.detail.preVisitStatus')}
          </span>

          <strong>
            {previsitStatusKey(preVisit.previsit_status)
              ? t(previsitStatusKey(preVisit.previsit_status)!)
              : preVisit.previsit_status}
          </strong>
        </div>

        <div
          className={
            styles.statusCard
          }
        >
          <span>
            {t('superadmin.preVisits.detail.contactResult')}
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
          {t('superadmin.preVisits.detail.agentSection')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('superadmin.preVisits.detail.agentName')}
            value={
              agent?.agent_name
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.salesCode')}
            value={
              agent?.sales_code
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.agentEmail')}
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
          {t('superadmin.preVisits.detail.customerSection')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('superadmin.preVisits.detail.customerId')}
            value={
              customer?.customer_id
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.customerName')}
            value={
              customer?.customer_name
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.mainPhone')}
            value={
              customer?.phone_number
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.altPhone1')}
            value={
              customer?.alternative_phone_1
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.altPhone2')}
            value={
              customer?.alternative_phone_2
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.altPhone3')}
            value={
              customer?.alternative_phone_3
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.region')}
            value={
              customer?.region
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.city')}
            value={
              customer?.city
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.district')}
            value={
              customer?.district
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.subDistrict')}
            value={
              customer?.sub_district
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.serviceAddress')}
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
          {t('superadmin.preVisits.detail.contactConfirmation')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('superadmin.preVisits.detail.contactAttempt')}
            value={formatDateTime(
              preVisit.contact_attempt_date
            )}
          />

          <Detail
            label={t('superadmin.preVisits.detail.contactConfirmed')}
            value={
              preVisit.contact_confirmed
                ? t('superadmin.status.yes')
                : t('superadmin.status.no')
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.contactResult')}
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
          {t('superadmin.preVisits.detail.addressConfirmation')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('superadmin.preVisits.detail.addressConfirmed')}
            value={
              preVisit.address_confirmed
                ? t('superadmin.status.yes')
                : t('superadmin.status.no')
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.landmark')}
            value={
              preVisit.landmark
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.confirmedAddress')}
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
          {t('superadmin.preVisits.detail.appointmentSection')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('superadmin.preVisits.detail.appointmentConfirmed')}
            value={
              preVisit.appointment_confirmed
                ? t('superadmin.status.yes')
                : t('superadmin.status.no')
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.appointmentDate')}
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
          {t('superadmin.preVisits.detail.supervisorSection')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('superadmin.preVisits.detail.supervisorApproval')}
            value={
              preVisit.supervisor_approval
                ? t('superadmin.status.approved')
                : t('superadmin.status.notApproved')
            }
          />

          <Detail
            label={t('superadmin.preVisits.detail.createdAt')}
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
          {t('superadmin.preVisits.detail.notesSection')}
        </h2>

        <p
          className={
            styles.notes
          }
        >
          {preVisit.previsit_notes ||
            t('superadmin.preVisits.detail.noNotes')}
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