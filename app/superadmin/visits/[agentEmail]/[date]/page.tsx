import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

export default async function AgentDailyVisitsPage({
  params,
}: {
  params: Promise<{
    agentEmail: string
    date: string
  }>
}) {
  const { agentEmail, date } = await params

  const decodedEmail = decodeURIComponent(agentEmail)

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

  if (!agent) {
    return (
      <main className={styles.page}>
        <div className={styles.errorCard}>
          {t('superadmin.visits.daily.notFound')}
        </div>
      </main>
    )
  }

  const startDate = `${date}T00:00:00+07:00`
  const endDate = `${date}T23:59:59.999+07:00`

  const { data: visits, error } = await supabase
    .from('visits')
    .select(`
      visit_id,
      customer_id,
      visit_date,
      visit_status_kunjungan,
      conversation_result,
      approved_offer,
      planned_payment_date,
      unpaid_reason,
      latitude,
      longitude,
      gps_accuracy,
      distance_to_customer_meters,
      location_match
    `)
    .eq('agent_email', decodedEmail)
    .gte('visit_date', startDate)
    .lte('visit_date', endDate)
    .order('visit_date', {
      ascending: false,
    })

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
      (visits ?? []).map(
        (visit) => visit.customer_id
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
        service_address,
        city,
        sub_district,
        payment_status,
        visit_status
      `)
      .in('customer_id', customerIds)

    customers = data ?? []
  }

  const customerMap = new Map(
    customers.map((customer) => [
      customer.customer_id,
      customer,
    ])
  )

  const totalVisits = visits?.length ?? 0

  const gpsMatchCount =
    visits?.filter(
      (visit) => visit.location_match === true
    ).length ?? 0

  const gpsMismatchCount =
    visits?.filter(
      (visit) => visit.location_match === false
    ).length ?? 0

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href={`/superadmin/visits/${encodeURIComponent(
            decodedEmail
          )}`}
          className={styles.backButton}
        >
          {t('superadmin.visits.daily.back')}
        </Link>

        <div>
          <p className={styles.eyebrow}>
            {t('superadmin.visits.daily.eyebrow')}
          </p>

          <h1>{agent.agent_name}</h1>

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
          <span>{t('superadmin.visits.daily.totalVisits')}</span>
          <strong>{totalVisits}</strong>
        </div>

        <div className={styles.statCard}>
          <span>{t('superadmin.visits.daily.gpsMatch')}</span>
          <strong>{gpsMatchCount}</strong>
        </div>

        <div className={styles.statCard}>
          <span>{t('superadmin.visits.daily.gpsMismatch')}</span>
          <strong>{gpsMismatchCount}</strong>
        </div>
      </section>

      <section className={styles.list}>
        {visits && visits.length > 0 ? (
          visits.map((visit) => {
            const customer =
              customerMap.get(
                visit.customer_id
              )

            return (
              <Link
                key={visit.visit_id}
                href={`/superadmin/visits/${encodeURIComponent(
                  decodedEmail
                )}/${date}/${encodeURIComponent(
                  visit.visit_id
                )}`}
                className={styles.visitCard}
              >
                <div className={styles.cardTop}>
                  <div>
                    <span className={styles.visitId}>
                      {visit.visit_id}
                    </span>

                    <h2>
                      {customer?.customer_name ||
                        visit.customer_id}
                    </h2>

                    <p>
                      {customer?.customer_id ||
                        visit.customer_id}
                    </p>
                  </div>

                  <span className={styles.arrow}>
                    ›
                  </span>
                </div>

                <div className={styles.infoGrid}>
                  <div>
                    <span>
                      {t('superadmin.visits.daily.visitStatus')}
                    </span>

                    <strong>
                      {visit.visit_status_kunjungan ||
                        '-'}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t('superadmin.visits.daily.conversationResult')}
                    </span>

                    <strong>
                      {visit.conversation_result ||
                        '-'}
                    </strong>
                  </div>

                  <div>
                    <span>{t('superadmin.visits.daily.payment')}</span>

                    <strong>
                      {customer?.payment_status
                        ? customer.payment_status.toUpperCase()
                        : '-'}
                    </strong>
                  </div>

                  <div>
                    <span>{t('superadmin.visits.daily.distance')}</span>

                    <strong>
                      {visit.distance_to_customer_meters !==
                      null
                        ? `${Number(
                            visit.distance_to_customer_meters
                          ).toFixed(1)} m`
                        : '-'}
                    </strong>
                  </div>
                </div>

                <div className={styles.footer}>
                  <span>
                    {new Date(
                      visit.visit_date
                    ).toLocaleTimeString(
                      'id-ID',
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </span>

                  <span
                    className={
                      visit.location_match === true
                        ? styles.matchBadge
                        : visit.location_match === false
                          ? styles.mismatchBadge
                          : styles.unknownBadge
                    }
                  >
                    {visit.location_match === true
                      ? t('superadmin.status.gpsMatch')
                      : visit.location_match === false
                        ? t('superadmin.status.gpsMismatch')
                        : t('superadmin.status.gpsUnknown')}
                  </span>
                </div>
              </Link>
            )
          })
        ) : (
          <div className={styles.emptyState}>
            <h2>{t('superadmin.visits.daily.emptyTitle')}</h2>

            <p>
              {t('superadmin.visits.daily.emptyDesc')}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}