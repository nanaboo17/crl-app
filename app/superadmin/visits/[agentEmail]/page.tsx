import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

export default async function AgentVisitDaysPage({
  params,
}: {
  params: Promise<{ agentEmail: string }>
}) {
  const { agentEmail } = await params

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
        {t('superadmin.visits.agentDays.notFound')}
      </main>
    )
  }

  const { data: visits, error } = await supabase
    .from('visits')
    .select(`
      visit_id,
      visit_date,
      location_match,
      conversation_result
    `)
    .eq('agent_email', decodedEmail)
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

  const grouped = new Map<
    string,
    {
      total: number
      match: number
      mismatch: number
    }
  >()

  for (const visit of visits ?? []) {
    const date = new Date(
      visit.visit_date
    )

    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')

    const current = grouped.get(key) ?? {
      total: 0,
      match: 0,
      mismatch: 0,
    }

    current.total += 1

    if (visit.location_match === true) {
      current.match += 1
    }

    if (visit.location_match === false) {
      current.mismatch += 1
    }

    grouped.set(key, current)
  }

  const days = Array.from(grouped.entries())

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href="/superadmin/visits"
          className={styles.backButton}
        >
          {t('superadmin.visits.agentDays.back')}
        </Link>

        <div>
          <p className={styles.eyebrow}>
            {t('superadmin.visits.agentDays.eyebrow')}
          </p>

          <h1>{agent.agent_name}</h1>

          <p>
            {agent.sales_code || '-'} ·{' '}
            {agent.email}
          </p>
        </div>
      </header>

      <section className={styles.summaryCard}>
        <span>{t('superadmin.visits.agentDays.totalVisits')}</span>
        <strong>{visits?.length ?? 0}</strong>
      </section>

      <section className={styles.list}>
        {days.length > 0 ? (
          days.map(([date, stats]) => (
            <Link
              key={date}
              href={`/superadmin/visits/${encodeURIComponent(
                decodedEmail
              )}/${date}`}
              className={styles.dayCard}
            >
              <div>
                <span className={styles.dateLabel}>
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
                </span>

                <strong>
                  {t('superadmin.visits.agentDays.visitsCount', { count: stats.total })}
                </strong>
              </div>

              <div className={styles.stats}>
                <span>
                  ✓ {stats.match}
                </span>

                <span>
                  ⚠ {stats.mismatch}
                </span>

                <span className={styles.arrow}>
                  ›
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className={styles.empty}>
            {t('superadmin.visits.agentDays.empty')}
          </div>
        )}
      </section>
    </main>
  )
}