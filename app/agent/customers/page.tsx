'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  ChevronRight,
  ClipboardList,
  MapPin,
  RotateCcw,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import type { AppRole } from '@/lib/types'
import { useI18n } from '@/components/providers/i18n-provider'

type CustomerRow = {
  customer_id: string
  customer_name: string
  priority_rank: number | null
  phone_number: string | null
  service_address: string | null
  city: string | null
  district: string | null
  sub_district: string | null
  invoice_amount: number | null
  payment_status: string | null
  estimated_churn_date: string | null
  days_left_to_churn: number | null
  customer_status: string | null
  visit_status: string | null
}

type AgentRow = {
  agent_name: string
  sales_code: string | null
  role: AppRole
  active: boolean
}

const PRIORITY_STYLES: Record<number, { badge: string; ring: string }> = {
  1: { badge: 'dui-badge-error dui-badge-soft', ring: 'border-error/30' },
  2: { badge: 'dui-badge-warning dui-badge-soft', ring: 'border-warning/30' },
  3: { badge: 'dui-badge-info dui-badge-soft', ring: 'border-info/30' },
  4: { badge: 'dui-badge-ghost', ring: 'border-base-300' },
  5: { badge: 'dui-badge-ghost', ring: 'border-base-300' },
}

function badgeClass(priority: number | null) {
  return (priority ? PRIORITY_STYLES[priority] : PRIORITY_STYLES[5]).badge
}

function initials(name: string) {
  return (name || 'P')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

function daysClass(days: number | null) {
  if (days === null) return { badge: 'dui-badge-ghost', overdue: false, days: null as number | null }
  if (days <= 0) return { badge: 'dui-badge-error dui-badge-soft', overdue: true, days: null as number | null }
  if (days <= 7) return { badge: 'dui-badge-warning dui-badge-soft', overdue: false, days }
  return { badge: 'dui-badge-ghost', overdue: false, days }
}

function paymentBadge(status: string | null) {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'paid' || s === 'lunas') return { badge: 'dui-badge-success dui-badge-soft', state: 'paid' as const }
  return { badge: 'dui-badge-warning dui-badge-soft', state: 'unpaid' as const }
}

export default function AgentCustomersPage() {
  const { t } = useI18n()
  const supabase = createClient()

  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [agent, setAgent] = useState<AgentRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sort, setSort] = useState('priority')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.email) {
        window.location.href = '/login'
        return
      }

      const email = user.email.trim().toLowerCase()

      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('agent_name, sales_code, role, active')
        .eq('email', email)
        .maybeSingle()

      if (agentError || !agentData || !agentData.active || agentData.role !== 'agent') {
        window.location.href = '/auth/route'
        return
      }

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select(`
          customer_id,
          customer_name,
          priority_rank,
          phone_number,
          service_address,
          city,
          district,
          sub_district,
          invoice_amount,
          payment_status,
          estimated_churn_date,
          days_left_to_churn,
          customer_status,
          visit_status
        `)
        .eq('agent_email', email)
        .order('priority_rank', { ascending: true })

      if (customerError) {
        setError(customerError.message)
      } else {
        setCustomers(customerData ?? [])
      }

      setAgent(agentData)
      setLoading(false)
    }

    loadData()
  }, [supabase])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    const list = customers.filter((customer) => {
      const matchesSearch =
        !q ||
        customer.customer_name?.toLowerCase().includes(q) ||
        customer.customer_id?.toLowerCase().includes(q) ||
        customer.city?.toLowerCase().includes(q) ||
        customer.district?.toLowerCase().includes(q) ||
        customer.sub_district?.toLowerCase().includes(q)

      const matchesPayment =
        paymentFilter === 'all' ||
        (paymentFilter === 'paid'
          ? (customer.payment_status ?? '').trim().toLowerCase() === 'paid'
          : (customer.payment_status ?? '').trim().toLowerCase() !== 'paid')

      const matchesPriority =
        priorityFilter === 'all' ||
        String(customer.priority_rank ?? '') === priorityFilter

      return matchesSearch && matchesPayment && matchesPriority
    })

    return [...list].sort((a, b) => {
      if (sort === 'priority') {
        return (a.priority_rank ?? 99) - (b.priority_rank ?? 99)
      }
      if (sort === 'churn') {
        return (a.days_left_to_churn ?? 999) - (b.days_left_to_churn ?? 999)
      }
      return (a.customer_name ?? '').localeCompare(b.customer_name ?? '')
    })
  }, [customers, search, paymentFilter, priorityFilter, sort])

  const pending = filtered.filter((c) => (c.visit_status ?? '').trim().toLowerCase() !== 'visited')
  const visited = filtered.filter((c) => (c.visit_status ?? '').trim().toLowerCase() === 'visited')

  const hasActiveFilter = search !== '' || paymentFilter !== 'all' || priorityFilter !== 'all'
  const firstName = agent?.agent_name?.trim().split(/\s+/)[0] ?? ''

  const stats = [
    { label: t('agent.customers.statTotal'), value: customers.length, icon: Users, current: false },
    { label: t('agent.customers.statPending'), value: pending.length, icon: MapPin, current: true },
    { label: t('agent.customers.statVisited'), value: visited.length, icon: ClipboardList, current: false },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[{ label: t('agent.customers.breadcrumbAgent'), href: '/agent', icon: UserRound }, { label: t('agent.customers.breadcrumbCustomers'), icon: Building2 }]}
        title={t('agent.customers.title')}
        description={
          agent
            ? t('agent.customers.descriptionWithName', {
                name: agent.agent_name,
                code: agent.sales_code ? `${t('agent.customers.codeSep')}${agent.sales_code}` : '',
              })
            : t('agent.customers.description')
        }
      />

      {error && (
        <div className="dui-alert dui-alert-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <section aria-label={t('agent.customers.summaryAria')} className="dui-stats dui-stats-vertical sm:dui-stats-horizontal w-full overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
        {stats.map(({ label, value, icon: Icon, current }) => (
          <div key={label} className={`dui-stat ${current ? 'text-primary' : ''}`}>
            <div className="dui-stat-figure text-base-content/25">
              <Icon aria-hidden="true" className="h-6 w-6" />
            </div>
            <div className="dui-stat-title">{label}</div>
            <div className="dui-stat-value">{value}</div>
          </div>
        ))}
      </section>

      <section aria-label={t('agent.customers.filterAria')} className="dui-card border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-card-body gap-3">
          <div className="dui-fieldset">
            <div className="dui-fieldset-label">
              <span>{t('agent.customers.searchLabel')}</span>
            </div>
            <label className="dui-input flex w-full items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-base-content/40" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('agent.customers.searchPlaceholder')}
                className="grow"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label={t('agent.customers.clearSearchAria')}
                  className="dui-btn dui-btn-ghost dui-btn-circle dui-btn-sm relative -mr-2"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="dui-fieldset">
              <div className="dui-fieldset-label">
                <span>{t('agent.customers.payment')}</span>
              </div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="dui-select w-full"
              >
                <option value="all">{t('agent.customers.all')}</option>
                <option value="paid">{t('agent.customers.paid')}</option>
                <option value="unpaid">{t('agent.customers.unpaid')}</option>
              </select>
            </div>

            <div className="dui-fieldset">
              <div className="dui-fieldset-label">
                <span>{t('agent.customers.priority')}</span>
              </div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="dui-select w-full"
              >
                <option value="all">{t('agent.customers.all')}</option>
                <option value="1">{t('agent.customers.priority1')}</option>
                <option value="2">{t('agent.customers.priority2')}</option>
                <option value="3">{t('agent.customers.priority3')}</option>
                <option value="4">{t('agent.customers.priority4')}</option>
                <option value="5">{t('agent.customers.priority5')}</option>
              </select>
            </div>

            <div className="dui-fieldset">
              <div className="dui-fieldset-label">
                <span>{t('agent.customers.sort')}</span>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="dui-select w-full"
              >
                <option value="priority">{t('agent.customers.sortPriority')}</option>
                <option value="churn">{t('agent.customers.sortChurn')}</option>
                <option value="name">{t('agent.customers.sortName')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-base-200 pt-3">
            <p className="text-sm text-base-content/60">
              {t('agent.customers.showingPrefix')}{' '}
              <span className="font-bold text-base-content">{filtered.length}</span>{' '}
              {t('agent.customers.showingSuffix', { total: customers.length })}
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setPaymentFilter('all')
                  setPriorityFilter('all')
                }}
                className="dui-btn dui-btn-ghost dui-btn-sm gap-1"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t('agent.customers.clearFilters')}
              </button>
            )}
          </div>
        </div>
      </section>

      {loading ? (
        <CustomerSkeleton t={t} />
      ) : (
        <>
          <CustomerSection
            t={t}
            title={t('agent.customers.sectionNeedsVisit')}
            count={pending.length}
            customers={pending}
            visited={false}
          />
          <CustomerSection
            t={t}
            title={t('agent.customers.sectionVisited')}
            count={visited.length}
            customers={visited}
            visited
          />
        </>
      )}
    </div>
  )
}

function CustomerSection({
  t,
  title,
  count,
  customers,
  visited,
}: {
  t: (key: string, params?: Record<string, string | number>) => string
  title: string
  count: number
  customers: CustomerRow[]
  visited: boolean
}) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-base-content">{title}</h2>
        <span className="dui-badge dui-badge-ghost">{count}</span>
      </div>

      {count > 0 ? (
        <ul className="dui-list w-full rounded-box border border-base-300 bg-base-100 shadow-sm">
          {customers.map((customer) => (
            <li key={customer.customer_id}>
              <Link
                href={`/agent/customers/${encodeURIComponent(customer.customer_id)}`}
                className="dui-list-row dui-list-col-grow hover:bg-base-200 transition-colors"
              >
                <CustomerCardBody t={t} customer={customer} visited={visited} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-box border border-dashed border-base-300 bg-base-100 px-6 py-10 text-center">
          <p className="font-semibold text-base-content">{t('agent.customers.emptyTitle')}</p>
          <p className="mt-1 text-sm text-base-content/60">
            {visited
              ? t('agent.customers.emptyVisited')
              : t('agent.customers.emptyPending')}
          </p>
        </div>
      )}
    </section>
  )
}

function CustomerCardBody({ t, customer, visited }: { t: (key: string, params?: Record<string, string | number>) => string; customer: CustomerRow; visited: boolean }) {
  const priority = customer.priority_rank
  const area =
    customer.sub_district || customer.district || customer.city || t('agent.customers.areaUnavailable')
  const churn = daysClass(customer.days_left_to_churn)
  const payment = paymentBadge(customer.payment_status)
  const color =
    priority === 1 ? t('agent.customers.priorityUrgent1')
    : priority === 2 ? t('agent.customers.priorityUrgent2')
    : priority === 3 ? t('agent.customers.priorityMedium')
    : priority === 4 ? t('agent.customers.priorityLow')
    : t('agent.customers.priorityLowest')

  return (
    <div className="flex w-full items-center gap-4 py-1">
      <div
        className={`dui-avatar dui-avatar-placeholder ${visited ? 'opacity-70' : ''}`}
        aria-hidden="true"
      >
        <div className="w-12 rounded-full bg-primary/10 text-primary font-black text-sm">
          {initials(customer.customer_name)}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="dui-badge dui-badge-sm">P{priority ?? '-'}</span>
          <span className="truncate font-bold text-base-content">
            {customer.customer_name}
          </span>
          {!visited && (
            <span
              className={`dui-badge dui-badge-sm ${priority ? PRIORITY_STYLES[priority].badge : ''}`}
            >
              {color}
            </span>
          )}
        </div>

        <p className="mt-0.5 truncate text-sm text-base-content/60">
          {customer.customer_id} · {area}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1 font-semibold text-base-content">
            <MapPin className="h-3.5 w-3.5 text-base-content/40" aria-hidden="true" />
            Rp{Number(customer.invoice_amount ?? 0).toLocaleString('id-ID')}
          </span>

          <span className={`dui-badge dui-badge-sm ${payment.badge}`}>
            {payment.state === 'paid' ? t('agent.customers.paidStatus') : t('agent.customers.unpaidStatus')}
          </span>

          <span className={`dui-badge dui-badge-sm ${churn.badge}`}>
            {churn.overdue
              ? t('agent.customers.overdue')
              : churn.days !== null
                ? t('agent.customers.daysUnit', { days: churn.days })
                : '-'}
          </span>
        </div>
      </div>

      <ChevronRight
        className={`h-5 w-5 shrink-0 ${visited ? 'text-base-content/30' : 'text-primary/60'}`}
        aria-hidden="true"
      />
    </div>
  )
}

function CustomerSkeleton({ t }: { t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <div aria-label={t('agent.customers.loadingAria')} className="space-y-8">
      {[0, 1].map((section) => (
        <section key={section}>
          <div className="mb-3 flex items-center gap-2">
            <div className="dui-skeleton h-5 w-32" />
            <div className="dui-skeleton h-5 w-8 rounded-full" />
          </div>
          <div className="space-y-0 rounded-box border border-base-300 bg-base-100">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-4 border-b border-base-200 p-4 last:border-0">
                <div className="dui-skeleton h-12 w-12 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="dui-skeleton h-4 w-2/3" />
                  <div className="dui-skeleton h-3 w-1/3" />
                </div>
                <div className="dui-skeleton h-6 w-8 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
