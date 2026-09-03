import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, ChevronRight, MapPin, Route, Sparkles, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import styles from './page.module.css'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

export default async function AgentVisitDaysPage({
  params,
}: {
  params: Promise<{ agentEmail: string }>
}) {
  const { agentEmail } = await params
  const decodedEmail = decodeURIComponent(agentEmail)
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, allMessages, key, params)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', user.email.trim().toLowerCase()).maybeSingle()
  if (!currentUser || !currentUser.active || currentUser.role !== 'superadmin') redirect('/auth/route')

  const { data: agent } = await supabase.from('agents').select('email, agent_name, sales_code').eq('email', decodedEmail).maybeSingle()
  if (!agent) return <main className={styles.page}><div className={styles.errorCard}>{t('superadmin.visits.agentDays.notFound')}</div></main>

  const { data: visits, error } = await supabase
    .from('visits')
    .select('visit_id, visit_date, location_match, conversation_result')
    .eq('agent_email', decodedEmail)
    .order('visit_date', { ascending: false })

  if (error) return <main className={styles.page}><div className={styles.errorCard}>{error.message}</div></main>

  const grouped = new Map<string, { total: number; match: number; mismatch: number }>()
  for (const visit of visits ?? []) {
    const date = new Date(visit.visit_date)
    const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
    const current = grouped.get(key) ?? { total: 0, match: 0, mismatch: 0 }
    current.total += 1
    if (visit.location_match === true) current.match += 1
    if (visit.location_match === false) current.mismatch += 1
    grouped.set(key, current)
  }

  const days = Array.from(grouped.entries())
  const gpsMatch = (visits ?? []).filter((visit) => visit.location_match === true).length
  const gpsMismatch = (visits ?? []).filter((visit) => visit.location_match === false).length
  const summaries = [
    { label: t('superadmin.visits.agentDays.totalVisits'), value: visits?.length ?? 0, icon: Route, tone: 'purple' },
    { label: tx('Active visit days', 'Hari kunjungan aktif'), value: days.length, icon: CalendarDays, tone: 'blue' },
    { label: tx('GPS match', 'GPS sesuai'), value: gpsMatch, icon: MapPin, tone: 'green' },
    { label: tx('GPS mismatch', 'GPS tidak sesuai'), value: gpsMismatch, icon: MapPin, tone: 'yellow' },
  ]

  return (
    <main className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: tx('Superadmin', 'Superadmin'), href: '/superadmin' },
          { label: tx('Visits', 'Kunjungan'), href: '/superadmin/visits', icon: MapPin },
          { label: agent.agent_name || agent.email, icon: UserRound },
        ]}
        title={agent.agent_name || tx('Agent Visits', 'Kunjungan Agen')}
        description={`${agent.sales_code || tx('No sales code', 'Tanpa sales code')} · ${agent.email}`}
      />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span><Sparkles aria-hidden="true" />{tx('FIELD JOURNEY', 'PERJALANAN LAPANGAN')}</span>
          <h2>{tx('See the agent’s field rhythm at a glance.', 'Lihat ritme lapangan agen dalam satu tampilan.')}</h2>
          <p>{tx('Track active visit days, GPS quality, and drill into the daily checkpoint timeline.', 'Pantau hari kunjungan aktif, kualitas GPS, lalu buka timeline checkpoint harian.')}</p>
        </div>
        <div className={styles.heroScene} aria-hidden="true">
          <span className={styles.routeOne} />
          <span className={styles.routeTwo} />
          <span className={styles.routePin}><MapPin /></span>
          <span className={styles.routeDotOne} />
          <span className={styles.routeDotTwo} />
        </div>
      </section>

      <section className={styles.statsGrid} aria-label={tx('Visit summary', 'Ringkasan kunjungan')}>
        {summaries.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className={`${styles.statCard} ${styles[`tone_${tone}`]}`}>
            <div className={styles.statIcon}><Icon aria-hidden="true" /></div>
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>

      <section className={styles.historyCard}>
        <div className={styles.sectionHeader}>
          <div><span>{tx('VISIT HISTORY', 'RIWAYAT KUNJUNGAN')}</span><h2>{tx('Visit history by day', 'Riwayat kunjungan per hari')}</h2></div>
          <p>{tx('Open a date to review checkpoints and individual visit details.', 'Buka tanggal untuk melihat checkpoint dan detail setiap kunjungan.')}</p>
        </div>
        <div className={styles.list}>
          {days.length > 0 ? days.map(([date, stats]) => (
            <Link key={date} href={`/superadmin/visits/${encodeURIComponent(decodedEmail)}/${date}`} className={styles.dayCard}>
              <div className={styles.dateIcon}><CalendarDays aria-hidden="true" /></div>
              <div className={styles.dateBlock}>
                <span className={styles.dateLabel}>{new Date(`${date}T00:00:00`).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                <strong>{t('superadmin.visits.agentDays.visitsCount', { count: stats.total })}</strong>
              </div>
              <div className={styles.cardRight}>
                <div className={styles.badges}><span className={styles.matchBadge}>✓ {stats.match} {tx('match', 'sesuai')}</span><span className={styles.mismatchBadge}>⚠ {stats.mismatch} {tx('mismatch', 'tidak sesuai')}</span></div>
                <ChevronRight className={styles.arrow} aria-hidden="true" />
              </div>
            </Link>
          )) : <div className={styles.empty}>{t('superadmin.visits.agentDays.empty')}</div>}
        </div>
      </section>
    </main>
  )
}
