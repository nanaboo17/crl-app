import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase-server'

import styles from './page.module.css'

export default async function AgentPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const email = user.email.trim().toLowerCase()

  const { data: agent, error } = await supabase
    .from('agents')
    .select(`
      email,
      agent_name,
      sales_code,
      role,
      active
    `)
    .eq('email', email)
    .maybeSingle()

  if (error) {
    return (
      <main className={styles.page}>
        <div className="alert alert-error">
          <div>
            <h2 className={styles.alertTitle}>Account Error</h2>
            <p>{error.message}</p>
          </div>
        </div>
      </main>
    )
  }

  if (!agent) {
    return (
      <main className={styles.page}>
        <div className="alert alert-warning">
          <div>
            <h2 className={styles.alertTitle}>Agent Not Found</h2>
            <p>Your login email is:</p>
            <strong>{email}</strong>
            <p>This email was not found in the Agents table.</p>
          </div>
        </div>
      </main>
    )
  }

  if (!agent.active) {
    return (
      <main className={styles.page}>
        <div className="alert alert-error">
          <div>
            <h2 className={styles.alertTitle}>Account Inactive</h2>
            <p>Your CRL account is currently inactive.</p>
          </div>
        </div>
      </main>
    )
  }

  if (agent.role !== 'agent') {
    redirect('/auth/route')
  }

  const { count: customerCount } = await supabase
    .from('customers')
    .select('*', {
      count: 'exact',
      head: true,
    })
    .eq('agent_email', email)

  return (
    <main className={styles.page}>
      <section className={`hero bg-base-200 ${styles.hero}`}>
        <div className={`hero-content ${styles.heroContent}`}>
          <div>
            <p className={styles.eyebrow}>CRL FIELD APP</p>
            <h1 className={styles.title}>Hi, {agent.agent_name}</h1>
            <div className="badge badge-primary badge-outline">
              {agent.sales_code || 'No Sales Code'}
            </div>
          </div>
        </div>
      </section>

      <section className={`stats shadow ${styles.stats}`}>
        <div className="stat">
          <div className="stat-title">My Customers</div>
          <div className="stat-value">{customerCount ?? 0}</div>
          <div className="stat-desc">Customers assigned to you</div>
        </div>
      </section>

      <ul className={`menu bg-base-100 rounded-box shadow ${styles.menu}`}>
        <li>
          <Link href="/agent/customers" className={styles.menuLink}>
            <div>
              <strong>My Customers</strong>
              <span>View customers assigned to you</span>
            </div>
            <span className={styles.chevron}>›</span>
          </Link>
        </li>

        <li>
          <Link href="/agent/route" className={styles.menuLink}>
            <div>
              <strong>Visit Route</strong>
              <span>Plan today's customers from nearest location</span>
            </div>
            <span className={styles.chevron}>›</span>
          </Link>
        </li>
      </ul>
    </main>
  )
}
