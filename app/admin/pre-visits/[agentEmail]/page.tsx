'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'

export default function AgentPreVisitDaysPage() {
  const params = useParams()
  const supabase = createClient()

  const decodedEmail = decodeURIComponent(
    params.agentEmail as string
  )

  const [agent, setAgent] = useState<any>(null)
  const [preVisits, setPreVisits] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.email) {
        window.location.href = '/login'
        return
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
        window.location.href =
          '/auth/route'
        return
      }

      const {
        data: agentData,
        error: agentError,
      } = await supabase
        .from('agents')
        .select(`
          email,
          agent_name,
          sales_code
        `)
        .eq('email', decodedEmail)
        .maybeSingle()

      if (agentError || !agentData) {
        setError(
          agentError?.message ||
            'Agent not found.'
        )

        setLoading(false)
        return
      }

      const {
        data: preVisitData,
        error: preVisitError,
      } = await supabase
        .from('pre_visits')
        .select(`
          previsit_id,
          customer_id,
          contact_attempt_date,
          previsit_status,
          contact_result
        `)
        .eq('agent_email', decodedEmail)
        .order('contact_attempt_date', {
          ascending: false,
        })

      if (preVisitError) {
        setError(preVisitError.message)
        setLoading(false)
        return
      }

      setAgent(agentData)
      setPreVisits(preVisitData ?? [])
      setLoading(false)
    }

    loadData()
  }, [decodedEmail])

  const filteredPreVisits = useMemo(() => {
    return preVisits.filter(
      (preVisit) => {
        const itemDate = new Date(
          preVisit.contact_attempt_date
        )

        if (startDate) {
          const start = new Date(
            `${startDate}T00:00:00`
          )

          if (itemDate < start) {
            return false
          }
        }

        if (endDate) {
          const end = new Date(
            `${endDate}T23:59:59`
          )

          if (itemDate > end) {
            return false
          }
        }

        return true
      }
    )
  }, [
    preVisits,
    startDate,
    endDate,
  ])

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number
        ready: number
        followUp: number
        review: number
        pending: number
      }
    >()

    for (
      const preVisit of filteredPreVisits
    ) {
      const d = new Date(
        preVisit.contact_attempt_date
      )

      const key = [
        d.getFullYear(),
        String(
          d.getMonth() + 1
        ).padStart(2, '0'),
        String(d.getDate()).padStart(
          2,
          '0'
        ),
      ].join('-')

      const current =
        map.get(key) ?? {
          total: 0,
          ready: 0,
          followUp: 0,
          review: 0,
          pending: 0,
        }

      current.total += 1

      switch (
        preVisit.previsit_status
      ) {
        case 'Ready for Visit':
          current.ready += 1
          break

        case 'Need Follow-up':
          current.followUp += 1
          break

        case 'Supervisor Review':
          current.review += 1
          break

        default:
          current.pending += 1
      }

      map.set(key, current)
    }

    return Array.from(
      map.entries()
    )
  }, [filteredPreVisits])

  function clearFilter() {
    setStartDate('')
    setEndDate('')
  }

  if (loading) {
    return (
      <main className={styles.page}>
        Loading pre-visits...
      </main>
    )
  }

  if (!agent) {
    return (
      <main className={styles.page}>
        <div
          className={
            styles.errorCard
          }
        >
          {error ||
            'Agent not found.'}
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header
        className={styles.header}
      >
        <Link
          href="/admin/pre-visits"
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
            PRE-VISIT ACTIVITY
          </p>

          <h1>
            {agent.agent_name}
          </h1>

          <p>
            {agent.sales_code ||
              '-'}{' '}
            · {agent.email}
          </p>
        </div>
      </header>

      <section
        className={
          styles.summaryCard
        }
      >
        <span>
          Filtered Pre-Visits
        </span>

        <strong>
          {
            filteredPreVisits.length
          }
        </strong>
      </section>

      <section
        className={
          styles.filterCard
        }
      >
        <div
          className={
            styles.filterGrid
          }
        >
          <label>
            From

            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                setStartDate(
                  e.target.value
                )
              }
            />
          </label>

          <label>
            To

            <input
              type="date"
              value={endDate}
              onChange={(e) =>
                setEndDate(
                  e.target.value
                )
              }
            />
          </label>
        </div>

        {(startDate ||
          endDate) && (
          <button
            type="button"
            className={
              styles.clearButton
            }
            onClick={
              clearFilter
            }
          >
            Clear Date Filter
          </button>
        )}
      </section>

      <section
        className={styles.list}
      >
        {grouped.length > 0 ? (
          grouped.map(
            ([date, stats]) => (
              <Link
                key={date}
                href={`/admin/pre-visits/${encodeURIComponent(
                  decodedEmail
                )}/${date}`}
                className={
                  styles.dayCard
                }
              >
                <div>
                  <span
                    className={
                      styles.dateLabel
                    }
                  >
                    {new Date(
                      `${date}T00:00:00`
                    ).toLocaleDateString(
                      'id-ID',
                      {
                        weekday:
                          'long',
                        day: '2-digit',
                        month:
                          'long',
                        year:
                          'numeric',
                      }
                    )}
                  </span>

                  <strong>
                    {stats.total}{' '}
                    Pre-Visits
                  </strong>
                </div>

                <div
                  className={
                    styles.stats
                  }
                >
                  <span
                    className={
                      styles.readyBadge
                    }
                  >
                    Ready{' '}
                    {stats.ready}
                  </span>

                  <span
                    className={
                      styles.followBadge
                    }
                  >
                    Follow-up{' '}
                    {stats.followUp}
                  </span>

                  <span
                    className={
                      styles.reviewBadge
                    }
                  >
                    Review{' '}
                    {stats.review}
                  </span>

                  <span
                    className={
                      styles.arrow
                    }
                  >
                    ›
                  </span>
                </div>
              </Link>
            )
          )
        ) : (
          <div
            className={styles.empty}
          >
            No pre-visits found
            for this date range.
          </div>
        )}
      </section>
    </main>
  )
}