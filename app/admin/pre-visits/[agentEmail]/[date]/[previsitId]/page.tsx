import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

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

  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, allMessages, key, params)

  const statusLabel = (status: string | null | undefined) => {
    if (status === 'Ready for Visit') return t('admin.status.readyForVisit')
    if (status === 'Need Follow-up') return t('admin.status.needFollowUp')
    if (status === 'Supervisor Review') return t('admin.status.supervisorReview')
    if (status === 'Pending') return t('admin.status.pending')
    return status ?? '-'
  }

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
          href={`/admin/pre-visits/${encodeURIComponent(
            decodedEmail
          )}/${date}`}
          className={
            styles.backButton
          }
        >
          {t('admin.back')}
        </Link>

        <div
          className={
            styles.errorCard
          }
        >
          {t('admin.preVisitDetail.notFound')}
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
          href={`/admin/pre-visits/${encodeURIComponent(
            decodedEmail
          )}/${date}`}
          className={
            styles.backButton
          }
        >
          {t('admin.back')}
        </Link>

        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            {t('admin.preVisitDetail.eyebrow')}
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
            {t('admin.preVisitDetail.status')}
          </span>

          <strong>
            {statusLabel(preVisit.previsit_status)}
          </strong>
        </div>

        <div
          className={
            styles.statusCard
          }
        >
          <span>
            {t('admin.preVisitDetail.contactResult')}
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
          {t('admin.preVisitDetail.agent')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('admin.preVisitDetail.agentName')}
            value={
              agent?.agent_name
            }
          />

          <Detail
            label={t('admin.preVisitDetail.salesCode')}
            value={
              agent?.sales_code
            }
          />

          <Detail
            label={t('admin.preVisitDetail.agentEmail')}
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
          {t('admin.preVisitDetail.customer')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('admin.preVisitDetail.customerId')}
            value={
              customer?.customer_id
            }
          />

          <Detail
            label={t('admin.preVisitDetail.customerName')}
            value={
              customer?.customer_name
            }
          />

          <Detail
            label={t('admin.preVisitDetail.mainPhone')}
            value={
              customer?.phone_number
            }
          />

          <Detail
            label={t('admin.preVisitDetail.altPhone1')}
            value={
              customer?.alternative_phone_1
            }
          />

          <Detail
            label={t('admin.preVisitDetail.altPhone2')}
            value={
              customer?.alternative_phone_2
            }
          />

          <Detail
            label={t('admin.preVisitDetail.altPhone3')}
            value={
              customer?.alternative_phone_3
            }
          />

          <Detail
            label={t('admin.preVisitDetail.region')}
            value={
              customer?.region
            }
          />

          <Detail
            label={t('admin.preVisitDetail.city')}
            value={
              customer?.city
            }
          />

          <Detail
            label={t('admin.preVisitDetail.district')}
            value={
              customer?.district
            }
          />

          <Detail
            label={t('admin.preVisitDetail.subDistrict')}
            value={
              customer?.sub_district
            }
          />

          <Detail
            label={t('admin.preVisitDetail.serviceAddress')}
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
          {t('admin.preVisitDetail.contactConfirmation')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('admin.preVisitDetail.contactAttempt')}
            value={formatDateTime(
              preVisit.contact_attempt_date
            )}
          />

          <Detail
            label={t('admin.preVisitDetail.contactConfirmed')}
            value={
              preVisit.contact_confirmed
                ? t('admin.preVisitDetail.yes')
                : t('admin.preVisitDetail.no')
            }
          />

          <Detail
            label={t('admin.preVisitDetail.contactResult')}
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
          {t('admin.preVisitDetail.addressConfirmation')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('admin.preVisitDetail.addressConfirmed')}
            value={
              preVisit.address_confirmed
                ? t('admin.preVisitDetail.yes')
                : t('admin.preVisitDetail.no')
            }
          />

          <Detail
            label={t('admin.preVisitDetail.landmark')}
            value={
              preVisit.landmark
            }
          />

          <Detail
            label={t('admin.preVisitDetail.confirmedAddress')}
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
          {t('admin.preVisitDetail.appointment')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('admin.preVisitDetail.appointmentConfirmed')}
            value={
              preVisit.appointment_confirmed
                ? t('admin.preVisitDetail.yes')
                : t('admin.preVisitDetail.no')
            }
          />

          <Detail
            label={t('admin.preVisitDetail.appointmentDate')}
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
          {t('admin.preVisitDetail.supervisor')}
        </h2>

        <div
          className={
            styles.grid
          }
        >
          <Detail
            label={t('admin.preVisitDetail.supervisorApproval')}
            value={
              preVisit.supervisor_approval
                ? t('admin.preVisitDetail.approved')
                : t('admin.preVisitDetail.notApproved')
            }
          />

          <Detail
            label={t('admin.preVisitDetail.createdAt')}
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
          {t('admin.preVisitDetail.notesTitle')}
        </h2>

        <p
          className={
            styles.notes
          }
        >
          {preVisit.previsit_notes ||
            t('admin.preVisitDetail.noNotes')}
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