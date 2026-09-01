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

export default async function AgentDailyPreVisitsPage({
  params,
}: {
  params: Promise<{
    agentEmail: string
    date: string
  }>
}) {
  const { agentEmail, date } = await params

  const decodedEmail =
    decodeURIComponent(agentEmail)

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

  const { data: currentUser } = await supabase
    .from('agents')
    .select('role, active')
    .eq(
      'email',
      user.email.trim().toLowerCase()
    )
    .maybeSingle()

  if (
    !currentUser ||
    !currentUser.active ||
    !['admin', 'superadmin'].includes(currentUser.role)
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

  if (!agent) {
    return (
      <main className={styles.page}>
        <div className={styles.errorCard}>
          {t('superadmin.preVisits.daily.notFound')}
        </div>
      </main>
    )
  }

  const startDate =
    `${date}T00:00:00+07:00`

  const endDate =
    `${date}T23:59:59.999+07:00`

  const { data: preVisits, error } =
    await supabase
      .from('pre_visits')
      .select(`
        previsit_id,
        customer_id,
        contact_attempt_date,
        contact_confirmed,
        address_confirmed,
        appointment_confirmed,
        appointment_date,
        contact_result,
        previsit_status,
        confirmed_address,
        landmark,
        previsit_notes
      `)
      .eq('agent_email', decodedEmail)
      .gte(
        'contact_attempt_date',
        startDate
      )
      .lte(
        'contact_attempt_date',
        endDate
      )
      .order(
        'contact_attempt_date',
        {
          ascending: false,
        }
      )

  if (error) {
    return (
      <main className={styles.page}>
        <div className={styles.errorCard}>
          {error.message}
        </div>
      </main>
    )
  }

  const customerIds = [
    ...new Set(
      (preVisits ?? []).map(
        (item) => item.customer_id
      )
    ),
  ]

  let customers: any[] = []

  if (customerIds.length > 0) {
    const { data } = await supabase
      .from('customers')
      .select(`
        customer_id,
        customer_name,
        phone_number,
        city,
        district,
        sub_district,
        service_address,
        customer_status,
        visit_status
      `)
      .in(
        'customer_id',
        customerIds
      )

    customers = data ?? []
  }

  const customerMap = new Map(
    customers.map((customer) => [
      customer.customer_id,
      customer,
    ])
  )

  const total =
    preVisits?.length ?? 0

  const readyCount =
    preVisits?.filter(
      (item) =>
        item.previsit_status ===
        'Ready for Visit'
    ).length ?? 0

  const followUpCount =
    preVisits?.filter(
      (item) =>
        item.previsit_status ===
        'Need Follow-up'
    ).length ?? 0

  const reviewCount =
    preVisits?.filter(
      (item) =>
        item.previsit_status ===
        'Supervisor Review'
    ).length ?? 0

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href={`/superadmin/pre-visits/${encodeURIComponent(
            decodedEmail
          )}`}
          className={styles.backButton}
        >
          {t('superadmin.preVisits.daily.back')}
        </Link>

        <div>
          <p className={styles.eyebrow}>
            {t('superadmin.preVisits.daily.eyebrow')}
          </p>

          <h1>
            {agent.agent_name}
          </h1>

          <p>
            {new Date(
              `${date}T00:00:00`
            ).toLocaleDateString(
              'id-ID',
              {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              }
            )}
          </p>
        </div>
      </header>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>{t('superadmin.preVisits.daily.total')}</span>
          <strong>{total}</strong>
        </div>

        <div className={styles.statCard}>
          <span>{t('superadmin.preVisits.daily.ready')}</span>
          <strong>
            {readyCount}
          </strong>
        </div>

        <div className={styles.statCard}>
          <span>{t('superadmin.preVisits.daily.followUp')}</span>
          <strong>
            {followUpCount}
          </strong>
        </div>

        <div className={styles.statCard}>
          <span>{t('superadmin.preVisits.daily.review')}</span>
          <strong>
            {reviewCount}
          </strong>
        </div>
      </section>

      <section className={styles.list}>
        {preVisits &&
        preVisits.length > 0 ? (
          preVisits.map(
            (preVisit) => {
              const customer =
                customerMap.get(
                  preVisit.customer_id
                )

              return (
                <Link
                  key={
                    preVisit.previsit_id
                  }
                  href={`/superadmin/pre-visits/${encodeURIComponent(
                    decodedEmail
                  )}/${date}/${encodeURIComponent(
                    preVisit.previsit_id
                  )}`}
                  className={
                    styles.preVisitCard
                  }
                >
                  <div
                    className={
                      styles.cardTop
                    }
                  >
                    <div>
                      <span
                        className={
                          styles.preVisitId
                        }
                      >
                        {
                          preVisit.previsit_id
                        }
                      </span>

                      <h2>
                        {customer?.customer_name ||
                          preVisit.customer_id}
                      </h2>

                      <p>
                        {preVisit.customer_id}
                      </p>
                    </div>

                    <span
                      className={
                        styles.arrow
                      }
                    >
                      ›
                    </span>
                  </div>

                  <div
                    className={
                      styles.infoGrid
                    }
                  >
                    <div>
                      <span>
                        {t('superadmin.preVisits.daily.contactResult')}
                      </span>

                      <strong>
                        {preVisit.contact_result ||
                          '-'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        {t('superadmin.preVisits.daily.preVisitStatus')}
                      </span>

                      <strong>
                        {previsitStatusKey(preVisit.previsit_status)
                          ? t(previsitStatusKey(preVisit.previsit_status)!)
                          : preVisit.previsit_status || '-'}
                      </strong>
                    </div>

                    <div>
                      <span>
                        {t('superadmin.preVisits.daily.contact')}
                      </span>

                      <strong>
                        {preVisit.contact_confirmed
                          ? t('superadmin.status.confirmed')
                          : t('superadmin.status.notConfirmed')}
                      </strong>
                    </div>

                    <div>
                      <span>
                        {t('superadmin.preVisits.daily.address')}
                      </span>

                      <strong>
                        {preVisit.address_confirmed
                          ? t('superadmin.status.confirmed')
                          : t('superadmin.status.notConfirmed')}
                      </strong>
                    </div>

                    <div>
                      <span>
                        {t('superadmin.preVisits.daily.appointment')}
                      </span>

                      <strong>
                        {preVisit.appointment_confirmed
                          ? t('superadmin.status.confirmed')
                          : t('superadmin.status.notConfirmed')}
                      </strong>
                    </div>

                    <div>
                      <span>
                        {t('superadmin.preVisits.daily.area')}
                      </span>

                      <strong>
                        {customer?.sub_district ||
                          customer?.district ||
                          customer?.city ||
                          '-'}
                      </strong>
                    </div>
                  </div>

                  <div
                    className={
                      styles.footer
                    }
                  >
                    <span>
                      {new Date(
                        preVisit.contact_attempt_date
                      ).toLocaleTimeString(
                        'id-ID',
                        {
                          hour:
                            '2-digit',
                          minute:
                            '2-digit',
                        }
                      )}
                    </span>

                    <span
                      className={
                        preVisit.previsit_status ===
                        'Ready for Visit'
                          ? styles.readyBadge
                          : preVisit.previsit_status ===
                              'Need Follow-up'
                            ? styles.followBadge
                            : preVisit.previsit_status ===
                                'Supervisor Review'
                              ? styles.reviewBadge
                              : styles.pendingBadge
                      }
                    >
                      {previsitStatusKey(preVisit.previsit_status)
                        ? t(previsitStatusKey(preVisit.previsit_status)!)
                        : preVisit.previsit_status}
                    </span>
                  </div>
                </Link>
              )
            }
          )
        ) : (
          <div
            className={
              styles.emptyState
            }
          >
            <h2>
              {t('superadmin.preVisits.daily.emptyTitle')}
            </h2>

            <p>
              {t('superadmin.preVisits.daily.emptyDesc')}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}