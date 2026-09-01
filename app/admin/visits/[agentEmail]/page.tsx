'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'
import { useI18n } from '@/components/providers/i18n-provider'

export default function AgentVisitDaysPage() {
  const { t } = useI18n()
  const params = useParams()
  const supabase = createClient()

  const decodedEmail = decodeURIComponent(
    params.agentEmail as string
  )

  const [agent, setAgent] = useState<any>(null)
  const [visits, setVisits] = useState<any[]>([])
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
        window.location.href = '/auth/route'
        return
      }

      const { data: agentData, error: agentError } =
        await supabase
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
          agentError?.message || t('admin.visitDays.agentNotFound')
        )
        setLoading(false)
        return
      }

      const { data: visitData, error: visitError } =
        await supabase
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

      if (visitError) {
        setError(visitError.message)
        setLoading(false)
        return
      }

      setAgent(agentData)
      setVisits(visitData ?? [])
      setLoading(false)
    }

    loadData()
  }, [decodedEmail])

  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      const visitDate = new Date(
        visit.visit_date
      )

      if (startDate) {
        const start = new Date(
          `${startDate}T00:00:00`
        )

        if (visitDate < start) {
          return false
        }
      }

      if (endDate) {
        const end = new Date(
          `${endDate}T23:59:59`
        )

        if (visitDate > end) {
          return false
        }
      }

      return true
    })
  }, [visits, startDate, endDate])

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number
        match: number
        mismatch: number
      }
    >()

    for (const visit of filteredVisits) {
      const d = new Date(visit.visit_date)

      const key = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-')

      const current = map.get(key) ?? {
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

      map.set(key, current)
    }

    return Array.from(map.entries())
  }, [filteredVisits])

  function clearFilter() {
    setStartDate('')
    setEndDate('')
  }

  if (loading) {
    return (
      <main className={styles.page}>
        {t('admin.visitDays.loading')}
      </main>
    )
  }

  if (!agent) {
    return (
      <main className={styles.page}>
        <div className={styles.errorCard}>
          {error || t('admin.visitDays.agentNotFound')}
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href="/admin/visits"
          className={styles.backButton}
        >
          {t('admin.back')}
        </Link>

        <div>
          <p className={styles.eyebrow}>
            {t('admin.visitDays.eyebrow')}
          </p>

          <h1>{agent.agent_name}</h1>

          <p>
            {agent.sales_code || '-'} ·{' '}
            {agent.email}
          </p>
        </div>
      </header>

      <section className={styles.summaryCard}>
        <span>{t('admin.visitDays.filtered')}</span>
        <strong>{filteredVisits.length}</strong>
      </section>

      <section className={styles.filterCard}>
        <div className={styles.filterGrid}>
          <label>
            {t('admin.visitDays.from')}

            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                setStartDate(e.target.value)
              }
            />
          </label>

          <label>
            {t('admin.visitDays.to')}

            <input
              type="date"
              value={endDate}
              onChange={(e) =>
                setEndDate(e.target.value)
              }
            />
          </label>
        </div>

        {(startDate || endDate) && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={clearFilter}
          >
            {t('admin.visitDays.clearFilter')}
          </button>
        )}
      </section>

      <section className={styles.list}>
        {grouped.length > 0 ? (
          grouped.map(([date, stats]) => (
            <Link
              key={date}
              href={`/admin/visits/${encodeURIComponent(
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
                  {t('admin.visitDays.totalLabel', { total: stats.total })}
                </strong>
              </div>

              <div className={styles.stats}>
                <span>✓ {stats.match}</span>
                <span>⚠ {stats.mismatch}</span>
                <span className={styles.arrow}>
                  ›
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className={styles.empty}>
            {t('admin.visitDays.empty')}
          </div>
        )}
      </section>
    </main>
  )
}