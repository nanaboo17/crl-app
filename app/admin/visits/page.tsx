'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'

export default function AdminVisitsPage() {
  const supabase = createClient()

  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [activityFilter, setActivityFilter] = useState('all')

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

      const email = user.email.trim().toLowerCase()

      const { data: currentUser } = await supabase
        .from('agents')
        .select('role, active')
        .eq('email', email)
        .maybeSingle()

      if (
        !currentUser ||
        !currentUser.active ||
        !['admin', 'superadmin'].includes(currentUser.role)
      ) {
        window.location.href = '/auth/route'
        return
      }

      const { data: agentRows, error: agentError } =
        await supabase
          .from('agents')
          .select(`
            email,
            agent_name,
            sales_code,
            active
          `)
          .eq('role', 'agent')
          .order('agent_name')

      if (agentError) {
        setError(agentError.message)
        setLoading(false)
        return
      }

      const enriched = await Promise.all(
        (agentRows ?? []).map(async (agent) => {
          const { data: visits } = await supabase
            .from('visits')
            .select(`
              visit_id,
              visit_date,
              location_match,
              conversation_result
            `)
            .eq('agent_email', agent.email)

          const rows = visits ?? []

          return {
            ...agent,
            visit_count: rows.length,
            gps_match: rows.filter(
              (v) => v.location_match === true
            ).length,
            gps_mismatch: rows.filter(
              (v) => v.location_match === false
            ).length,
            last_visit_date:
              rows.length > 0
                ? rows
                    .map((v) => new Date(v.visit_date))
                    .sort(
                      (a, b) =>
                        b.getTime() - a.getTime()
                    )[0]
                : null,
          }
        })
      )

      setAgents(enriched)
      setLoading(false)
    }

    loadData()
  }, [])

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase()

    return agents.filter((agent) => {
      const matchesSearch =
        !q ||
        agent.agent_name
          ?.toLowerCase()
          .includes(q) ||
        agent.email
          ?.toLowerCase()
          .includes(q) ||
        agent.sales_code
          ?.toLowerCase()
          .includes(q)

      const matchesActivity =
        activityFilter === 'all' ||
        (activityFilter === 'has-visits' &&
          agent.visit_count > 0) ||
        (activityFilter === 'no-visits' &&
          agent.visit_count === 0)

      return matchesSearch && matchesActivity
    })
  }, [agents, search, activityFilter])

  if (loading) {
    return (
      <main className={styles.page}>
        <p>Loading visit monitoring...</p>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href="/admin"
          className={styles.backButton}
        >
          ← Back
        </Link>

        <div>
          <p className={styles.eyebrow}>
            ADMIN
          </p>

          <h1>Visit Monitoring</h1>

          <p>
            Review visit activity per agent.
          </p>
        </div>
      </header>

      <section className={styles.filterCard}>
        <label>
          Search Agent

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Agent name, email, sales code..."
          />
        </label>

        <label>
          Activity

          <select
            value={activityFilter}
            onChange={(e) =>
              setActivityFilter(e.target.value)
            }
          >
            <option value="all">
              All Agents
            </option>

            <option value="has-visits">
              Has Visits
            </option>

            <option value="no-visits">
              No Visits
            </option>
          </select>
        </label>
      </section>

      <section className={styles.resultHeader}>
        <span>Agents</span>
        <strong>
          {filteredAgents.length}
        </strong>
      </section>

      {error && (
        <div className={styles.errorCard}>
          {error}
        </div>
      )}

      <section className={styles.list}>
        {filteredAgents.map((agent) => (
          <Link
            key={agent.email}
            href={`/admin/visits/${encodeURIComponent(
              agent.email
            )}`}
            className={styles.agentCard}
          >
            <div>
              <h2>{agent.agent_name}</h2>

              <p>
                {agent.sales_code || '-'}
              </p>

              <small>
                {agent.email}
              </small>
            </div>

            <div className={styles.right}>
              <strong>
                {agent.visit_count}
              </strong>

              <span>Visits</span>

              <small>
                ✓ {agent.gps_match} · ⚠{' '}
                {agent.gps_mismatch}
              </small>

              <span className={styles.arrow}>
                ›
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  )
}