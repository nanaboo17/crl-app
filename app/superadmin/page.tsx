import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Building2,
  ClipboardList,
  MapPin,
  Users,
} from 'lucide-react'

import { createClient } from '../../lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

export default async function SuperadminPage() {
  const supabase = await createClient()
  const locale = await getLocale()

  const tl = (
    key: string,
    params?: Record<string, string | number>
  ) => translate(locale, allMessages, key, params)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('agent_name, email, role, active')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()

  if (!agent || !agent.active || agent.role !== 'superadmin') {
    redirect('/auth/route')
  }

  const [
    agentsResult,
    customersResult,
    preVisitsResult,
    visitsResult,
  ] = await Promise.all([
    supabase.from('agents').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }),
    supabase.from('visits').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    {
      href: '/superadmin/agents',
      label: tl('superadmin.dashboard.statAgents'),
      count: agentsResult.count ?? 0,
      icon: Users,
      manageKey: 'superadmin.dashboard.manageAgents',
      manageLabel: tl('superadmin.bc.agents'),
    },
    {
      href: '/superadmin/customers',
      label: tl('superadmin.dashboard.statCustomers'),
      count: customersResult.count ?? 0,
      icon: Building2,
      manageKey: 'superadmin.dashboard.manageCustomers',
      manageLabel: tl('superadmin.bc.customers'),
    },
    {
      href: '/superadmin/pre-visits',
      label: tl('superadmin.dashboard.statPreVisits'),
      count: preVisitsResult.count ?? 0,
      icon: ClipboardList,
      manageKey: 'superadmin.dashboard.managePreVisits',
      manageLabel: tl('superadmin.bc.preVisits'),
    },
    {
      href: '/superadmin/visits',
      label: tl('superadmin.dashboard.statVisits'),
      count: visitsResult.count ?? 0,
      icon: MapPin,
      manageKey: 'superadmin.dashboard.manageVisits',
      manageLabel: tl('superadmin.bc.visits'),
    },
  ]

  const firstName = agent.agent_name?.trim().split(/\s+/)[0] ?? 'Superadmin'

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          {
            label: tl('superadmin.bc.superadmin'),
            href: '/superadmin',
          },
          {
            label: tl('superadmin.dashboard.breadcrumbDashboard'),
          },
        ]}
        title={tl('superadmin.dashboard.title')}
        description={tl('superadmin.dashboard.welcomeBack', {
          name: firstName,
        })}
      />

      <section
        aria-label={tl('superadmin.dashboard.statisticsAria')}
        className={styles.statsGrid}
      >
        {stats.map(
          ({ href, label, count, icon: Icon, manageKey, manageLabel }) => (
            <Link key={href} href={href} className={styles.statCard}>
              <div className={styles.statTop}>
                <div>
                  <div className={styles.statLabel}>{label}</div>
                  <div className={styles.statValue}>{count}</div>
                </div>
                <div className={styles.iconBox}>
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </div>
              </div>

              <div className={styles.statFooter}>
                {tl(manageKey, { name: manageLabel })}
              </div>
            </Link>
          )
        )}
      </section>
    </div>
  )
}
