import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase-server'

export default async function SuperadminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('agent_name, email, role, active')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()

  if (!agent || !agent.active || agent.role !== 'superadmin') {
    redirect('/auth/route')
  }

  const [
    agentsResult,
    customersResult,
    preVisitsResult,
    visitsResult,
  ] = await Promise.all([
    supabase
      .from('agents')
      .select('*', { count: 'exact', head: true }),

    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true }),

    supabase
      .from('pre_visits')
      .select('*', { count: 'exact', head: true }),

    supabase
      .from('visits')
      .select('*', { count: 'exact', head: true }),
  ])

  return (
    <main className="mobile-page">
      <section className="page-header">
        <p className="eyebrow">CRL FIELD APP</p>
        <h1>Superadmin</h1>
      </section>

      <section className="card">
        <strong>{agent.agent_name}</strong>
        <p>{agent.email}</p>
        <span>Superadmin</span>
      </section>

      <section className="stats-grid">
        <div className="card stat-card">
          <strong>{agentsResult.count ?? 0}</strong>
          <span>Agents</span>
        </div>

        <div className="card stat-card">
          <strong>{customersResult.count ?? 0}</strong>
          <span>Customers</span>
        </div>

        <div className="card stat-card">
          <strong>{preVisitsResult.count ?? 0}</strong>
          <span>Pre-Visits</span>
        </div>

        <div className="card stat-card">
          <strong>{visitsResult.count ?? 0}</strong>
          <span>Visits</span>
        </div>
      </section>

      <section className="action-list">
        <Link href="/superadmin/agents" className="action-card">
          Manage Agents
        </Link>

        <Link href="/superadmin/customers" className="action-card">
          Manage Customers
        </Link>

        <Link href="/superadmin/pre-visits" className="action-card">
          Manage Pre-Visits
        </Link>

        <Link href="/superadmin/visits" className="action-card">
          Manage Visits
        </Link>
      </section>
    </main>
  )
}