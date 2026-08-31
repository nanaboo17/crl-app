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
        <div className={styles.errorCard}>
          <h2>Account Error</h2>
          <p>{error.message}</p>
        </div>
      </main>
    )
  }

  if (!agent) {
    return (
      <main className={styles.page}>
        <div className={styles.errorCard}>
          <h2>Agent Not Found</h2>
          <p>
            Your login email is:
          </p>

          <strong>{email}</strong>

          <p>
            This email was not found in the Agents table.
          </p>
        </div>
      </main>
    )
  }

  if (!agent.active) {
    return (
      <main className={styles.page}>
        <div className={styles.errorCard}>
          <h2>Account Inactive</h2>
          <p>
            Your CRL account is currently inactive.
          </p>
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
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          CRL FIELD APP
        </p>

        <h1>
          Hi, {agent.agent_name}
        </h1>

        <p className={styles.salesCode}>
          {agent.sales_code || 'No Sales Code'}
        </p>
      </header>

      <section className={styles.stats}>
        <div className={styles.statCard}>
          <span>My Customers</span>
          <strong>{customerCount ?? 0}</strong>
        </div>
      </section>

      <section className={styles.menu}>
        <Link
          href="/agent/customers"
          className={styles.menuCard}
        >
          <div>
            <strong>My Customers</strong>
            <p>
              View customers assigned to you
            </p>
          </div>

          <span>›</span>
        </Link>

        <Link
  href="/agent/route"
  className={styles.menuCard}
>
  <div>
    <strong>Visit Route</strong>

    <p>
      Plan today's customers from nearest location
    </p>
  </div>

  <span>›</span>
</Link>
      </section>
    </main>
  )
}