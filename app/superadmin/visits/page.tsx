import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'

export default async function SuperadminVisitsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
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
    !['superadmin'].includes(currentUser.role)
  ) {
    redirect('/auth/route')
  }

  const { data: agents, error } = await supabase
    .from('agents')
    .select(`
      email,
      agent_name,
      sales_code,
      active
    `)
    .eq('role', 'agent')
    .order('agent_name')

  if (error) {
    return (
      <main className={styles.page}>
        <div className={styles.errorCard}>
          {error.message}
        </div>
      </main>
    )
  }

  const agentData = await Promise.all(
    (agents ?? []).map(async (agent) => {
      const { count } = await supabase
        .from('visits')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('agent_email', agent.email)

      return {
        ...agent,
        visit_count: count ?? 0,
      }
    })
  )

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href="/superadmin"
          className={styles.backButton}
        >
          ← Back
        </Link>

        <div>
          <p className={styles.eyebrow}>
            SUPERADMIN
          </p>

          <h1>Visit Monitoring</h1>

          <p>
            Select agent to review visit activity.
          </p>
        </div>
      </header>

      <section className={styles.summaryCard}>
        <span>Total Agents</span>
        <strong>{agentData.length}</strong>
      </section>

      <section className={styles.list}>
        {agentData.map((agent) => (
          <Link
            key={agent.email}
            href={`/superadmin/visits/${encodeURIComponent(
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