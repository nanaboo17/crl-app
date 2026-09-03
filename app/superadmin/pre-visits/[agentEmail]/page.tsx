import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ClipboardList, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import styles from './page.module.css'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

export default async function AgentPreVisitDaysPage({ params }: { params: Promise<{ agentEmail: string }> }) {
  const { agentEmail } = await params
  const decodedEmail = decodeURIComponent(agentEmail)
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, allMessages, key, params)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', user.email.trim().toLowerCase()).maybeSingle()
  if (!currentUser || !currentUser.active || !['admin', 'superadmin'].includes(currentUser.role)) redirect('/auth/route')

  const { data: agent } = await supabase.from('agents').select('email, agent_name, sales_code').eq('email', decodedEmail).maybeSingle()
  if (!agent) return <main className={styles.page}><div className={styles.errorCard}>{t('superadmin.preVisits.agentDays.notFound')}</div></main>

  const { data: preVisits, error } = await supabase
    .from('pre_visits')
    .select('previsit_id,customer_id,contact_attempt_date,previsit_status,contact_result')
    .eq('agent_email', decodedEmail)
    .order('contact_attempt_date', { ascending: false })

  if (error) return <main className={styles.page}><div className={styles.errorCard}>{error.message}</div></main>

  const grouped = new Map<string, { total: number; ready: number; followUp: number; review: number }>()
  for (const preVisit of preVisits ?? []) {
    const date = new Date(preVisit.contact_attempt_date)
    const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
    const current = grouped.get(key) ?? { total: 0, ready: 0, followUp: 0, review: 0 }
    current.total += 1
    if (preVisit.previsit_status === 'Ready for Visit') current.ready += 1
    if (preVisit.previsit_status === 'Need Follow-up') current.followUp += 1
    if (preVisit.previsit_status === 'Supervisor Review') current.review += 1
    grouped.set(key, current)
  }

  const days = Array.from(grouped.entries())

  return (
    <main className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: tx('Pre-Visits', 'Pra-Kunjungan'), href: '/superadmin/pre-visits', icon: ClipboardList },
          { label: agent.agent_name || agent.email, icon: UserRound },
        ]}
        title={agent.agent_name || tx('Agent Pre-Visits', 'Pra-Kunjungan Agen')}
        description={`${agent.sales_code || '-'} · ${agent.email}`}
      />

      <section className={styles.summaryCard}>
        <span>{t('superadmin.preVisits.agentDays.totalPreVisits')}</span>
        <strong>{preVisits?.length ?? 0}</strong>
      </section>

      <section className={styles.list}>
        {days.length > 0 ? days.map(([date, stats]) => (
          <Link key={date} href={`/superadmin/pre-visits/${encodeURIComponent(decodedEmail)}/${date}`} className={styles.dayCard}>
            <div>
              <span className={styles.dateLabel}>{new Date(`${date}T00:00:00`).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
              <strong>{t('superadmin.preVisits.agentDays.preVisitsCount', { count: stats.total })}</strong>
            </div>
            <div className={styles.stats}>
              <span className={styles.readyBadge}>{t('superadmin.preVisits.agentDays.ready', { count: stats.ready })}</span>
              <span className={styles.followBadge}>{t('superadmin.preVisits.agentDays.followUp', { count: stats.followUp })}</span>
              <span className={styles.reviewBadge}>{t('superadmin.preVisits.agentDays.review', { count: stats.review })}</span>
              <span className={styles.arrow}>›</span>
            </div>
          </Link>
        )) : <div className={styles.empty}>{t('superadmin.preVisits.agentDays.empty')}</div>}
      </section>
    </main>
  )
}
