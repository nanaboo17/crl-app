import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'

export default async function ManageAgentsPage() {
  const supabase = await createClient()

  const { data: agents, error } = await supabase
    .from('agents')
    .select('email, agent_name, sales_code, role, active')
    .order('agent_name')

  if (error) {
    return (
      <main className="mobile-page">
        <p>{error.message}</p>
      </main>
    )
  }

  return (
    <main className="mobile-page">
      <h1>Manage Agents</h1>

      <Link
        href="/superadmin/agents/new"
        className="primary-button"
      >
        + Add Agent
      </Link>

      <div className="agent-list">
        {agents?.map((agent) => (
          <Link
            key={agent.email}
            href={`/superadmin/agents/${encodeURIComponent(agent.email)}`}
            className="agent-row"
          >
            <div>
              <strong>{agent.agent_name}</strong>

              <p>{agent.sales_code || '-'}</p>

              <small>{agent.email}</small>
            </div>

            <div className="agent-right">
              <span>{agent.role}</span>

              <small>
                {agent.active ? 'Active' : 'Inactive'}
              </small>

              <span>›</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}