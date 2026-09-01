import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { createClient } from '../../lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

export default async function SuperadminPage() {
  const supabase = await createClient()
  const locale = await getLocale()
  const tl = (key: string, params?: Record<string, string | number>) =>
    translate(locale, allMessages, key, params)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // The layout already guards this route; kept for narrowing below.
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

  const [agentsResult, customersResult, preVisitsResult, visitsResult] =
    await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('pre_visits').select('*', { count: 'exact', head: true }),
      supabase.from('visits').select('*', { count: 'exact', head: true }),
    ])

  const manageLabel = {
    agents: tl('superadmin.bc.agents'),
    customers: tl('superadmin.bc.customers'),
    preVisits: tl('superadmin.bc.preVisits'),
    visits: tl('superadmin.bc.visits'),
  }
  const manageKey = {
    agents: 'superadmin.dashboard.manageAgents',
    customers: 'superadmin.dashboard.manageCustomers',
    preVisits: 'superadmin.dashboard.managePreVisits',
    visits: 'superadmin.dashboard.manageVisits',
  }

  const stats = [
    {
      href: '/superadmin/agents',
      label: tl('superadmin.dashboard.statAgents'),
      count: agentsResult.count ?? 0,
      icon: Users,
      manageKey: manageKey.agents,
    },
    {
      href: '/superadmin/customers',
      label: tl('superadmin.dashboard.statCustomers'),
      count: customersResult.count ?? 0,
      icon: Building2,
      manageKey: manageKey.customers,
    },
    {
      href: '/superadmin/pre-visits',
      label: tl('superadmin.dashboard.statPreVisits'),
      count: preVisitsResult.count ?? 0,
      icon: ClipboardList,
      manageKey: manageKey.preVisits,
    },
    {
      href: '/superadmin/visits',
      label: tl('superadmin.dashboard.statVisits'),
      count: visitsResult.count ?? 0,
      icon: MapPin,
      manageKey: manageKey.visits,
    },
  ]

  const firstName = agent.agent_name?.trim().split(/\s+/)[0] ?? 'Superadmin'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: tl('superadmin.bc.superadmin'), href: '/superadmin', icon: ShieldCheck },
          { label: tl('superadmin.dashboard.breadcrumbDashboard'), icon: LayoutDashboard },
        ]}
        title={tl('superadmin.dashboard.title')}
        description={tl('superadmin.dashboard.welcomeBack', { name: firstName })}
      />

      {/* Each stat links into its management section */}
      <section
        aria-label={tl('superadmin.dashboard.statisticsAria')}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map(({ href, label, count, icon: Icon, manageKey: mk }) => (
          <Link
            key={href}
            href={href}
            className="dui-stat grid-cols-1 gap-4 border border-base-300 bg-base-100 transition-colors hover:border-base-content/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content"
          >
            <div className="dui-stat-figure text-base-content/25">
              <Icon aria-hidden="true" className="h-6 w-6" />
            </div>
            <div className="dui-stat-title">{label}</div>
            <div className="dui-stat-value text-3xl">{count}</div>
            <div className="dui-stat-desc">
              manageLabel: tl('superadmin.bc.agents') →
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
