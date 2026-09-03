import { redirect } from 'next/navigation'
import { Building2, MapPinned, Route, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import TerritoryManager from '@/components/territories/TerritoryManager'
import { getLocale } from '@/lib/i18n/server'
import styles from './page.module.css'

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

  const [territoriesResult, sitesResult, homepassesResult, assignedResult] = await Promise.all([
    supabase.from('territories').select('territory_id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('territory_sites').select('site_id', { count: 'exact', head: true }),
    supabase.from('territory_homepasses').select('customer_id', { count: 'exact', head: true }),
    supabase.from('territories').select('territory_id', { count: 'exact', head: true }).not('agent_email', 'is', null).eq('active', true),
  ])

  const summary = [
    { label: tx('Active Territories', 'Teritori Aktif'), value: territoriesResult.count ?? 0, icon: MapPinned, tone: 'purple' },
    { label: tx('Sites', 'Site'), value: sitesResult.count ?? 0, icon: Building2, tone: 'green' },
    { label: tx('Mapped Homepasses', 'Homepass Terpetakan'), value: homepassesResult.count ?? 0, icon: Route, tone: 'yellow' },
    { label: tx('Assigned Territories', 'Teritori Terisi Agen'), value: assignedResult.count ?? 0, icon: Users, tone: 'blue' },
  ]

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[{ label: 'Superadmin', href: '/superadmin' }, { label: tx('Territories', 'Teritori'), icon: MapPinned }]}
        title={tx('Territory & Homepass Management', 'Manajemen Teritori & Homepass')}
        description={tx(
          'Organize field coverage from territory to site to homepass, then keep agent ownership synchronized.',
          'Atur cakupan lapangan dari teritori ke site hingga homepass, lalu sinkronkan kepemilikan agen.'
        )}
      />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{tx('FIELD COVERAGE', 'CAKUPAN LAPANGAN')}</span>
          <h1>{tx('Build a cleaner field map.', 'Bangun peta lapangan yang lebih rapi.')}</h1>
          <p>{tx(
            'Create territories, group sites, map customers, and assign one field owner for every coverage area.',
            'Buat teritori, kelompokkan site, petakan pelanggan, dan tetapkan satu pemilik lapangan untuk tiap area.'
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
            <span>{tx('COVERAGE BUILDER', 'PENGATUR CAKUPAN')}</span>
            <h2>{tx('Territory workspace', 'Workspace teritori')}</h2>
          </div>
          <p>{tx('Agent → Territory → Site → Homepass', 'Agen → Teritori → Site → Homepass')}</p>
        </div>
        <div className={styles.managerWrap}>
          <TerritoryManager />
        </div>
      </section>
    </div>
  )
}
