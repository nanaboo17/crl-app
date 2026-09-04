import { redirect } from 'next/navigation'
import { Building2, MapPinned, Route, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import TerritoryManager from '@/components/territories/TerritoryManager'
import { getLocale } from '@/lib/i18n/server'
import styles from './page.module.css'

type CoverageRow = {
  region: string | null
  territory_code: string
  site_count: number | string
  customer_count: number | string
  agent_email: string | null
}

export default async function SuperadminTerritoriesPage() {
  const supabase = await createClient()
  const locale = await getLocale()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { data: agent } = await supabase
    .from('agents')
    .select('role,active')
    .eq('email', user.email.trim().toLowerCase())
    .maybeSingle()

  if (!agent || !agent.active || agent.role !== 'superadmin') redirect('/auth/route')

  const { data: coverageData } = await supabase.rpc('get_territory_coverage')
  const coverage = (coverageData || []) as CoverageRow[]
  const regions = new Set(coverage.map((row) => row.region).filter(Boolean))
  const totalSites = coverage.reduce((sum, row) => sum + Number(row.site_count || 0), 0)
  const totalCustomers = coverage.reduce((sum, row) => sum + Number(row.customer_count || 0), 0)
  const assignedTerritories = coverage.filter((row) => row.agent_email).length

  const summary = [
    { label: tx('Regions', 'Region'), value: regions.size, icon: MapPinned, tone: 'purple' },
    { label: tx('Territories', 'Teritori'), value: coverage.length, icon: Route, tone: 'green' },
    { label: tx('Sites', 'Site'), value: totalSites, icon: Building2, tone: 'yellow' },
    { label: tx('Mapped Customers', 'Pelanggan Terpetakan'), value: totalCustomers, icon: Users, tone: 'blue' },
  ]

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[{ label: 'Superadmin', href: '/superadmin' }, { label: tx('Territories', 'Teritori'), icon: MapPinned }]}
        title={tx('Territory Coverage', 'Cakupan Teritori')}
        description={tx(
          'Coverage is synchronized from customer region, territory, and site data. Assign field agents directly to each territory.',
          'Cakupan disinkronkan dari data region, teritori, dan site pelanggan. Tetapkan agen lapangan langsung ke setiap teritori.'
        )}
      />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{tx('LIVE CUSTOMER COVERAGE', 'CAKUPAN PELANGGAN LIVE')}</span>
          <h1>{tx('Region → Territory → Site → Customer', 'Region → Teritori → Site → Pelanggan')}</h1>
          <p>{tx(
            `${regions.size} regions · ${coverage.length} territories · ${assignedTerritories} territories assigned to agents.`,
            `${regions.size} region · ${coverage.length} teritori · ${assignedTerritories} teritori sudah memiliki agen.`
          )}</p>
        </div>
        <div className={styles.mapScene} aria-hidden="true">
          <div className={styles.mapPin}>⌖</div>
          <div className={styles.routeLine} />
          <div className={styles.siteDotOne} />
          <div className={styles.siteDotTwo} />
          <div className={styles.siteDotThree} />
        </div>
      </section>

      <section className={styles.summaryGrid}>
        {summary.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className={`${styles.summaryCard} ${styles[`tone_${tone}`]}`}>
            <div className={styles.summaryIcon}><Icon aria-hidden="true" /></div>
            <strong>{value.toLocaleString('id-ID')}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>

      <section className={styles.managerPanel}>
        <div className={styles.sectionHead}>
          <div>
            <span>{tx('COVERAGE ASSIGNMENT', 'PENUGASAN CAKUPAN')}</span>
            <h2>{tx('Territory workspace', 'Workspace teritori')}</h2>
          </div>
          <p>{tx('7 operational regions · synced from BigQuery customer data', '7 region operasional · tersinkron dari data pelanggan BigQuery')}</p>
        </div>
        <div className={styles.managerWrap}>
          <TerritoryManager />
        </div>
      </section>
    </div>
  )
}
