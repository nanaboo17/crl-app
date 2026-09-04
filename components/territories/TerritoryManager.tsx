'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import styles from './TerritoryManager.module.css'

type Agent = {
  email: string
  agent_name: string
  sales_code: string | null
}

type CoverageRow = {
  region: string | null
  phase: string | null
  territory_code: string
  site_count: number | string
  customer_count: number | string
  p1_count: number | string
  p2_count: number | string
  p3_count: number | string
  p4_count: number | string
  p5_count: number | string
  paid_count: number | string
  unpaid_count: number | string
  agent_email: string | null
}

const REGIONS = ['JABO 1', 'JABO 2', 'WJ', 'CJ', 'EJ', 'SS', 'NS'] as const
const PHASES = ['Phase 1', 'Phase 2', 'Phase 3'] as const

export default function TerritoryManager() {
  const supabase = createClient()
  const [agents, setAgents] = useState<Agent[]>([])
  const [coverage, setCoverage] = useState<CoverageRow[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL')
  const [selectedPhase, setSelectedPhase] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    const [agentsResult, coverageResult] = await Promise.all([
      supabase
        .from('agents')
        .select('email,agent_name,sales_code')
        .eq('role', 'agent')
        .eq('active', true)
        .order('agent_name'),
      supabase.rpc('get_territory_coverage'),
    ])

    const firstError = agentsResult.error || coverageResult.error
    if (firstError) setError(firstError.message)

    setAgents((agentsResult.data || []) as Agent[])
    setCoverage((coverageResult.data || []) as CoverageRow[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return coverage.filter((row) => {
      if (selectedRegion !== 'ALL' && row.region !== selectedRegion) return false
      if (selectedPhase !== 'ALL' && row.phase !== selectedPhase) return false
      if (!q) return true

      const assignedAgent = agents.find(
        (agent) => agent.email.toLowerCase() === row.agent_email?.toLowerCase()
      )

      return [
        row.territory_code,
        row.region || '',
        row.phase || '',
        assignedAgent?.agent_name || '',
        row.agent_email || '',
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [agents, coverage, search, selectedPhase, selectedRegion])

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.sites += Number(row.site_count || 0)
        acc.customers += Number(row.customer_count || 0)
        if (row.agent_email) acc.assigned += 1
        return acc
      },
      { sites: 0, customers: 0, assigned: 0 }
    )
  }, [filtered])

  async function assignAgent(territoryCode: string, email: string) {
    setSavingCode(territoryCode)
    setError('')

    const { error: rpcError } = await supabase.rpc('set_territory_agent_by_code', {
      p_territory_code: territoryCode,
      p_agent_email: email || null,
    })

    if (rpcError) setError(rpcError.message)
    else await load()

    setSavingCode(null)
  }

  if (loading) return <div className={styles.loading} />

  return (
    <div className={styles.manager}>
      {error && <div className={styles.alert}>{error}</div>}

      <div className={styles.toolbar}>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-45"
            aria-hidden="true"
          />
          <input
            className={styles.search}
            style={{ paddingLeft: '2.35rem' }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search territory, region, phase, or agent"
          />
        </div>

        <button type="button" className={styles.refreshButton} onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div>
        <div className={styles.filterLabel}>Region</div>
        <div className={styles.regionTabs}>
          <button
            type="button"
            className={`${styles.regionButton} ${selectedRegion === 'ALL' ? styles.regionButtonActive : ''}`}
            onClick={() => setSelectedRegion('ALL')}
          >
            All
          </button>

          {REGIONS.map((region) => (
            <button
              key={region}
              type="button"
              className={`${styles.regionButton} ${selectedRegion === region ? styles.regionButtonActive : ''}`}
              onClick={() => setSelectedRegion(region)}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={styles.filterLabel}>Phase</div>
        <div className={styles.regionTabs}>
          <button
            type="button"
            className={`${styles.regionButton} ${selectedPhase === 'ALL' ? styles.regionButtonActive : ''}`}
            onClick={() => setSelectedPhase('ALL')}
          >
            All
          </button>

          {PHASES.map((phase) => (
            <button
              key={phase}
              type="button"
              className={`${styles.regionButton} ${selectedPhase === phase ? styles.regionButtonActive : ''}`}
              onClick={() => setSelectedPhase(phase)}
            >
              {phase}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.summaryLine}>
        <span><strong>{filtered.length.toLocaleString('id-ID')}</strong> territories</span>
        <span>·</span>
        <span><strong>{totals.sites.toLocaleString('id-ID')}</strong> active sites</span>
        <span>·</span>
        <span><strong>{totals.customers.toLocaleString('id-ID')}</strong> active customers</span>
        <span>·</span>
        <span><strong>{totals.assigned.toLocaleString('id-ID')}</strong> assigned territories</span>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>No territories match the selected filters.</div>
      ) : (
        <div className={styles.territoryGrid}>
          {filtered.map((row) => {
            const assignedAgent = agents.find(
              (agent) => agent.email.toLowerCase() === row.agent_email?.toLowerCase()
            )

            const priorities = [
              ['P1', row.p1_count],
              ['P2', row.p2_count],
              ['P3', row.p3_count],
              ['P4', row.p4_count],
              ['P5', row.p5_count],
            ] as const

            return (
              <section key={row.territory_code} className={styles.territoryCard}>
                <div className={styles.cardTop}>
                  <div>
                    <span className={styles.codeBadge}>{row.territory_code}</span>
                    <h3 className={styles.territoryName}>{row.territory_code}</h3>

                    <div className={styles.badgeRow}>
                      <span className={styles.regionBadge}>{row.region || 'Unmapped region'}</span>
                      <span className={styles.phaseBadge}>{row.phase || 'No phase'}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.metrics}>
                  <div className={styles.metric}>
                    <strong>{Number(row.site_count || 0).toLocaleString('id-ID')}</strong>
                    <span>Active sites</span>
                  </div>
                  <div className={styles.metric}>
                    <strong>{Number(row.customer_count || 0).toLocaleString('id-ID')}</strong>
                    <span>Active customers</span>
                  </div>
                </div>

                <div className={styles.priorityRow} aria-label="Customer priority distribution">
                  {priorities.map(([label, value]) => (
                    <div key={label} className={styles.priorityChip}>
                      <strong>{label}</strong>
                      <span>{Number(value || 0).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.paymentRow}>
                  <span className={styles.paymentChip}>Paid {Number(row.paid_count || 0).toLocaleString('id-ID')}</span>
                  <span className={styles.paymentChip}>Unpaid {Number(row.unpaid_count || 0).toLocaleString('id-ID')}</span>
                </div>

                <label className={styles.field}>
                  <span className={styles.label}><UserRound className="inline h-4 w-4" /> Assigned agent</span>
                  <select
                    className={styles.select}
                    disabled={savingCode === row.territory_code}
                    value={row.agent_email || ''}
                    onChange={(event) => void assignAgent(row.territory_code, event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {agents.map((agent) => (
                      <option key={agent.email} value={agent.email}>
                        {agent.agent_name} · {agent.sales_code || agent.email}
                      </option>
                    ))}
                  </select>
                </label>

                {assignedAgent && (
                  <p className={styles.agentNote}>
                    {assignedAgent.agent_name} owns all unfinished unpaid customers in this territory.
                  </p>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
