'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Building2, ClipboardList, LayoutDashboard, MapPin, UserCheck, UserCog } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { getCurrentProfile } from '@/lib/auth'
import type { Agent } from '@/lib/types'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { useI18n } from '@/components/providers/i18n-provider'

export default function AdminDashboard() {
  const { t } = useI18n()
  const [profile, setProfile] = useState<Agent | null>(null)
  const [counts, setCounts] = useState({
    total: 0,
    assigned: 0,
    preVisits: 0,
    visits: 0,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const p = await getCurrentProfile()
        if (p.role !== 'admin') {
          return window.location.replace(p.role === 'superadmin' ? '/superadmin' : '/agent')
        }

        setProfile(p)
        const s = createClient()
        const [
          { count: total },
          { count: assigned },
          { count: preVisits },
          { count: visits },
        ] = await Promise.all([
          s.from('customers').select('*', { count: 'exact', head: true }),
          s
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .not('agent_email', 'is', null),
          s.from('pre_visits').select('*', { count: 'exact', head: true }),
          s.from('visits').select('*', { count: 'exact', head: true }),
        ])

        setCounts({
          total: total || 0,
          assigned: assigned || 0,
          preVisits: preVisits || 0,
          visits: visits || 0,
        })
      } catch (e: any) {
        setError(e.message)
      }
    })()
  }, [])

  if (!profile && !error) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <SuperadminPageHeader
          breadcrumbs={[{ label: t('admin.dashboard.breadcrumbAdmin'), href: '/admin', icon: UserCog }, { label: t('admin.dashboard.breadcrumbDashboard'), icon: LayoutDashboard }]}
          title={t('admin.dashboard.title')}
          description={t('admin.dashboard.loading')}
        />
        <div className="dui-loading dui-loading-spinner dui-loading-lg text-primary" />
      </div>
    )
  }

  const firstName = profile?.agent_name?.trim().split(/\s+/)[0] ?? t('admin.dashboard.adminFallback')

  const stats = [
    {
      href: '/admin/customers',
      label: t('admin.dashboard.statCustomers'),
      count: counts.total,
      icon: Building2,
    },
    {
      href: '/admin/customers',
      label: t('admin.dashboard.statAssigned'),
      count: counts.assigned,
      icon: UserCheck,
    },
    {
      href: '/admin/pre-visits',
      label: t('admin.dashboard.statPreVisits'),
      count: counts.preVisits,
      icon: ClipboardList,
    },
    {
      href: '/admin/visits',
      label: t('admin.dashboard.statVisits'),
      count: counts.visits,
      icon: MapPin,
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[{ label: t('admin.dashboard.breadcrumbAdmin'), href: '/admin', icon: UserCog }, { label: t('admin.dashboard.breadcrumbDashboard'), icon: LayoutDashboard }]}
        title={t('admin.dashboard.title')}
        description={t('admin.dashboard.welcomeBack', { name: firstName })}
        actions={
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-content transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t('admin.dashboard.manageCustomers')}
          </Link>
        }
      />

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {error}
        </div>
      )}

      {profile && (
        <section
          aria-label={t('admin.dashboard.statsAria')}
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
              <div className="dui-stat-value text-3xl">{count}</div>
              <div className="dui-stat-desc">{t('admin.dashboard.manage', { label: label.toLowerCase() })}</div>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
