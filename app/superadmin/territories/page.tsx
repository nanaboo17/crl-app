import { redirect } from 'next/navigation'
import { MapPinned } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import TerritoryManager from '@/components/territories/TerritoryManager'
import styles from './page.module.css'

export default async function SuperadminTerritoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const { data: agent } = await supabase.from('agents').select('role,active').eq('email', user.email.trim().toLowerCase()).maybeSingle()
  if (!agent || !agent.active || agent.role !== 'superadmin') redirect('/auth/route')

  return <div className={styles.page}>
    <SuperadminPageHeader
      breadcrumbs={[{ label: 'Superadmin', href: '/superadmin' }, { label: 'Territories', icon: MapPinned }]}
      title="Territory & Homepass Management"
      description="Assign agents by territory, group sites under each territory, and map homepasses to sites. AE name is synchronized from the assigned agent."
    />
    <TerritoryManager />
  </div>
}
