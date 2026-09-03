import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, ChevronRight, ClipboardList, Clock3, Sparkles, UserRound } from 'lucide-react'
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

  const { data: preVisits, error } = await supabase.from('pre_visits').select('previsit_id,customer_id,contact_attempt_date,previsit_status,contact_result').eq('agent_email', decodedEmail).order('contact_attempt_date', { ascending: false })
  if (error) return <main className={styles.page}><div className={styles.errorCard}>{error.message}</div></main>

  const grouped = new Map<string, { total: number; ready: number; followUp: number; review: number }>()
  for (const preVisit of preVisits ?? []) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(preVisit.contact_attempt_date))
    const current = grouped.get(key) ?? { total: 0, ready: 0, followUp: 0, review: 0 }
    current.total += 1
    if (preVisit.previsit_status === 'Ready for Visit') current.ready += 1
    if (preVisit.previsit_status === 'Need Follow-up') current.followUp += 1
    if (preVisit.previsit_status === 'Supervisor Review') current.review += 1
    grouped.set(key, current)
  }

  const days = Array.from(grouped.entries())
  const readyTotal = (preVisits ?? []).filter((item) => item.previsit_status === 'Ready for Visit').length
  const followUpTotal = (preVisits ?? []).filter((item) => item.previsit_status === 'Need Follow-up').length
  const summaries = [
    { label: tx('Total pre-visits', 'Total pra-kunjungan'), value: preVisits?.length ?? 0, icon: ClipboardList, tone: 'purple' },
    { label: tx('Active days', 'Hari aktif'), value: days.length, icon: CalendarDays, tone: 'blue' },
    { label: tx('Ready for visit', 'Siap dikunjungi'), value: readyTotal, icon: UserRound, tone: 'green' },
    { label: tx('Need follow-up', 'Perlu tindak lanjut'), value: followUpTotal, icon: Clock3, tone: 'yellow' },
  ]

  return (
    <main className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: tx('Pre-Visits', 'Pra-Kunjungan'), href: '/superadmin/pre-visits', icon: ClipboardList },
          { label: agent.agent_name || agent.email, icon: UserRound },
        ]}
        title={agent.agent_name || tx('Agent Pre-Visits', 'Pra-Kunjungan Agen')}
        description={`${agent.sales_code || tx('No sales code', 'Tanpa sales code')} · ${agent.email}`}
      />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span><Sparkles aria-hidden="true" />{tx('PRE-VISIT JOURNEY', 'ALUR PRA-KUNJUNGAN')}</span>
          <h2>{tx('Keep every customer preparation visible.', 'Pastikan setiap persiapan pelanggan terlihat.')}</h2>
          <p>{tx('Review readiness, follow-ups, and supervisor-review workload before the agent goes to the field.', 'Tinjau kesiapan, tindak lanjut, dan beban review supervisor sebelum agen turun ke lapangan.')}</p>
        </div>
        <div className={styles.heroScene} aria-hidden="true"><span className={styles.phone}>☎</span><span className={styles.check}>✓</span><span className={styles.calendar}>▦</span></div>
      </section>

      <section className={styles.statsGrid}>
        {summaries.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className={`${styles.statCard} ${styles[`tone_${tone}`]}`}><div className={styles.statIcon}><Icon aria-hidden="true" /></div><strong>{value}</strong><span>{label}</span></article>
        ))}
      </section>

      <section className={styles.historyCard}>
        <div className={styles.sectionHeader}><div><span>{tx('PRE-VISIT HISTORY', 'RIWAYAT PRA-KUNJUNGAN')}</span><h2>{tx('Pre-visit history by day', 'Riwayat pra-kunjungan per hari')}</h2></div><p>{tx('Open a date to review each customer pre-visit record.', 'Buka tanggal untuk melihat setiap catatan pra-kunjungan pelanggan.')}</p></div>
        <div className={styles.list}>
          {days.length > 0 ? days.map(([date, stats]) => (
            <Link key={date} href={`/superadmin/pre-visits/${encodeURIComponent(decodedEmail)}/${date}`} className={styles.dayCard}>
              <div className={styles.dateIcon}><CalendarDays aria-hidden="true" /></div>
              <div className={styles.dateBlock}><span className={styles.dateLabel}>{new Date(`${date}T00:00:00`).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span><strong>{t('superadmin.preVisits.agentDays.preVisitsCount', { count: stats.total })}</strong></div>
              <div className={styles.cardRight}><div className={styles.badges}><span className={styles.readyBadge}>{tx('Ready', 'Siap')} {stats.ready}</span><span className={styles.followBadge}>{tx('Follow-up', 'Tindak lanjut')} {stats.followUp}</span>{stats.review > 0 && <span className={styles.reviewBadge}>{tx('Review', 'Review')} {stats.review}</span>}</div><ChevronRight className={styles.arrow} /></div>
            </Link>
          )) : <div className={styles.empty}>{t('superadmin.preVisits.agentDays.empty')}</div>}
        </div>
      </section>
    </main>
  )
}
