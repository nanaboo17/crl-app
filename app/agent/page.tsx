'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getCurrentProfile } from '@/lib/auth'
import type { Agent } from '@/lib/types'
import AgentNav from '@/components/AgentNav'
import Loading from '@/components/Loading'

export default function AgentDashboard() {
  const [profile, setProfile] = useState<Agent | null>(null)
  const [counts, setCounts] = useState({ customers: 0, ready: 0, visits: 0 })
  const [error, setError] = useState('')

  useEffect(() => { (async () => {
    try {
      const p = await getCurrentProfile()
      if (p.role !== 'agent') return window.location.replace(p.role === 'admin' ? '/admin' : '/superadmin')
      setProfile(p)
      const supabase = createClient()
      const [{ count: customers }, { count: ready }, { count: visits }] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).gt('outstanding_amount', 0),
        supabase.from('pre_visits').select('*', { count: 'exact', head: true }).eq('previsit_status', 'Ready for Visit'),
        supabase.from('visits').select('*', { count: 'exact', head: true }),
      ])
      setCounts({ customers: customers ?? 0, ready: ready ?? 0, visits: visits ?? 0 })
    } catch (e: any) { setError(e.message) }
  })() }, [])

  if (!profile && !error) return <main className="container"><Loading text="Loading dashboard…"/></main>
  const initials = profile?.agent_name.split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase()

  return <main className="container">
    <header className="page-header"><div><div className="muted small">CRL FIELD APP</div><h1 className="page-title">Home</h1></div></header>
    {error && <div className="card error-card">{error}</div>}
    {profile && <>
      <section className="card profile-card"><div className="avatar">{initials}</div><div className="truncate"><div className="profile-name">{profile.agent_name}</div><div className="muted small">{profile.sales_code || 'No sales code'}</div><div className="muted small truncate">{profile.email}</div></div></section>
      <section className="section"><h2 className="section-title">My workload</h2><div className="grid grid-3">
        <div className="card kpi-card"><div className="kpi-label">Unpaid customers</div><div className="kpi">{counts.customers}</div></div>
        <div className="card kpi-card"><div className="kpi-label">Ready for visit</div><div className="kpi">{counts.ready}</div></div>
        <div className="card kpi-card"><div className="kpi-label">Visits submitted</div><div className="kpi">{counts.visits}</div></div>
      </div></section>
      <section className="section"><h2 className="section-title">Quick actions</h2><div className="actions">
        <Link className="btn" href="/agent/customers">My Customers</Link>
        <Link className="btn secondary" href="/agent/pre-visits">Pre-Visits</Link>
        <Link className="btn secondary" href="/agent/visits">Visit History</Link>
      </div></section>
    </>}
    <AgentNav/>
  </main>
}
