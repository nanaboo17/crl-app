import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

export default async function AdminPreVisitsPage() {
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, allMessages, key, params)
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
    !['admin', 'superadmin'].includes(currentUser.role)
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
        .from('pre_visits')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('agent_email', agent.email)

      return {
        ...agent,
        previsit_count: count ?? 0,
      }
    })
  )

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href="/admin"
          className={styles.backButton}
        >
          {t('admin.back')}
        </Link>

        <div>
          <p className={styles.eyebrow}>
            {t('admin.preVisits.eyebrow')}
          </p>

          <h1>{t('admin.preVisits.title')}</h1>

          <p>
            {t('admin.preVisits.subtitle')}
          </p>
        </div>
      </header>

      <section className={styles.summaryCard}>
        <span>{t('admin.preVisits.totalAgents')}</span>
        <strong>{agentData.length}</strong>
      </section>

      <section className={styles.list}>
        {agentData.map((agent) => (
          <Link
            key={agent.email}
            href={`/admin/pre-visits/${encodeURIComponent(
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
                {agent.previsit_count}
              </strong>

              <span>
                {t('admin.preVisits.count')}
              </span>

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