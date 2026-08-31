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

export default async function SuperadminPage() {
  const supabase = await createClient()

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

  const stats = [
    {
      href: '/superadmin/agents',
      label: 'Agents',
      count: agentsResult.count ?? 0,
      icon: Users,
    },
    {
      href: '/superadmin/customers',
      label: 'Customers',
      count: customersResult.count ?? 0,
      icon: Building2,
    },
    {
      href: '/superadmin/pre-visits',
      label: 'Pre-Visits',
      count: preVisitsResult.count ?? 0,
      icon: ClipboardList,
    },
    {
      href: '/superadmin/visits',
      label: 'Visits',
      count: visitsResult.count ?? 0,
      icon: MapPin,
    },
  ]

  const firstName = agent.agent_name?.trim().split(/\s+/)[0] ?? 'Superadmin'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: 'Dashboard' },
        ]}
        title="Dashboard"
        description={`Welcome back, ${firstName}. Here is what is happening across CRL field operations.`}
      />

      {/* Each stat links into its management section */}
      <section
        aria-label="Statistics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map(({ href, label, count, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="stat border border-base-300 bg-base-100 transition-colors hover:border-base-content/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content"
          >
            <div className="stat-figure text-base-content/25">
              <Icon aria-hidden="true" className="h-6 w-6" />
            </div>
            <div className="stat-title">{label}</div>
            <div className="stat-value text-3xl">{count}</div>
            <div className="stat-desc">Manage {label.toLowerCase()} →</div>
          </Link>
        ))}
      </section>
    </div>
  )
}
