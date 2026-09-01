import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, ClipboardList, LayoutDashboard, MapPin, Route, UserRound } from 'lucide-react'

import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

export default async function AgentPage() {
  const supabase = await createClient()
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, allMessages, key, params)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const email = user.email.trim().toLowerCase()

  const { data: agent, error } = await supabase
    .from('agents')
    .select(`
      email,
      agent_name,
      sales_code,
      role,
      active
    `)
    .eq('email', email)
    .maybeSingle()

  if (error) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {t('agent.dashboard.accountError', { message: error.message })}
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          {t('agent.dashboard.agentNotFound', { email })}
        </div>
      </div>
    )
  }

  if (!agent.active) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
          {t('agent.dashboard.accountInactive')}
        </div>
      </div>
    )
  }

  if (agent.role !== 'agent') {
    redirect('/auth/route')
  }

  const [customersResult, preVisitsResult, visitsResult] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('agent_email', email),
    supabase.from('pre_visits').select('*', { count: 'exact', head: true }).eq('agent_email', email),
    supabase.from('visits').select('*', { count: 'exact', head: true }).eq('agent_email', email),
  ])

  const firstName = agent.agent_name?.trim().split(/\s+/)[0] ?? 'Agent'

  const stats = [
    {
      href: '/agent/customers',
      label: t('agent.dashboard.statCustomers'),
      count: customersResult.count ?? 0,
      icon: Building2,
    },
    {
      href: '/agent/route',
      label: t('agent.dashboard.statRoute'),
      count: 0,
      icon: Route,
    },
    {
      href: '/agent/pre-visits',
      label: t('agent.dashboard.statPreVisits'),
      count: preVisitsResult.count ?? 0,
      icon: ClipboardList,
    },
    {
      href: '/agent/visits',
      label: t('agent.dashboard.statVisits'),
      count: visitsResult.count ?? 0,
      icon: MapPin,
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[{ label: t('agent.dashboard.breadcrumbAgent'), href: '/agent', icon: UserRound }, { label: t('agent.dashboard.breadcrumbDashboard'), icon: LayoutDashboard }]}
        title={t('agent.dashboard.title')}
        description={t('agent.dashboard.description', { name: firstName })}
        actions={
          <Link
            href="/agent/customers"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-content transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t('agent.dashboard.myCustomers')}
          </Link>
        }
      />

      <section
        aria-label={t('agent.dashboard.statsAria')}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map(({ href, label, count, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="dui-stat grid-cols-1 gap-4 border border-base-300 bg-base-100 transition-colors hover:border-base-content/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content"
          >
            <div className="dui-stat-figure text-base-content/25">
              <Icon aria-hidden="true" className="h-6 w-6" />
            </div>
            <div className="dui-stat-title">{label}</div>
            <div className="dui-stat-value text-3xl">{count.toLocaleString()}</div>
            <div className="dui-stat-desc">{t('agent.dashboard.manage', { name: label.toLowerCase() })}</div>
          </Link>
        ))}
      </section>
    </div>
  )
}
