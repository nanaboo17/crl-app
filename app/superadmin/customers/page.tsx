import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, ChevronDown, CircleDollarSign, Eye, Filter, Inbox, MapPinned, Search, Upload, UserCheck, UserPlus, UsersRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { cacheGetOrSet } from '@/lib/redis-cache'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

const PAGE_SIZE = 10
const CACHE_TTL = 30
const STATUS_FILTERS = ['all', 'unassigned', 'assigned', 'visited', 'paid'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

type CustomerRow = {
  crl_id: string
  customer_id: string
  case_month: string | null
  customer_name: string | null
  phone_number: string | null
  outstanding_amount: number | null
  customer_status: string | null
  visit_status: string | null
  agent_email: string | null
  lead_email: string | null
  priority_rank: string | null
  region: string | null
  city: string | null
  district: string | null
  payment_status: string | null
  assign_status: string | null
  assignment_date: string | null
  suspension_date: string | null
  estimated_churn_date: string | null
}

type CustomerGroup = {
  customer_id: string
  cycles: CustomerRow[]
  latest: CustomerRow
}

type CustomerCache = {
  totalAll: number
  assigned: number
  visited: number
  paid: number
  unassigned: number
  filteredTotal: number
  customers: CustomerGroup[]
  regions: string[]
  leadEmails: string[]
}

function cycleSort(a: CustomerRow, b: CustomerRow) {
  const monthCompare = String(b.case_month || '').localeCompare(String(a.case_month || ''))
  if (monthCompare !== 0) return monthCompare
  return (b.crl_id || '').localeCompare(a.crl_id || '', undefined, { numeric: true })
}

function groupCustomers(rows: CustomerRow[]) {
  const grouped = new Map<string, CustomerRow[]>()
  for (const row of rows) {
    const key = String(row.customer_id || '').trim()
    if (!key) continue
    const current = grouped.get(key) ?? []
    current.push(row)
    grouped.set(key, current)
  }

  return Array.from(grouped.entries()).map(([customer_id, cycles]) => {
    const sorted = [...cycles].sort(cycleSort)
    return { customer_id, cycles: sorted, latest: sorted[0] }
  })
}

export default async function ManageCustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const requestedPage = Math.max(1, Math.floor(Number(params.page) || 1))
  const requestedStatus = typeof params.status === 'string' ? params.status.toLowerCase() : 'all'
  const status: StatusFilter = STATUS_FILTERS.includes(requestedStatus as StatusFilter) ? requestedStatus as StatusFilter : 'all'
  const region = typeof params.region === 'string' && params.region.trim() ? params.region.trim() : 'all'
  const leadEmail = typeof params.lead_email === 'string' && params.lead_email.trim() ? params.lead_email.trim() : 'all'
  const rawSearch = typeof params.q === 'string' ? params.q.trim() : ''
  const search = rawSearch.slice(0, 100)
  const safeSearch = search.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, allMessages, key, values)
  const tx = (en: string, id: string) => locale === 'id' ? id : en
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const buildCustomersHref = (nextStatus: StatusFilter = status, nextPage = 1, nextRegion = region, nextLeadEmail = leadEmail, nextSearch = search) => {
    const query = new URLSearchParams()
    query.set('status', nextStatus)
    if (nextRegion && nextRegion !== 'all') query.set('region', nextRegion)
    if (nextLeadEmail && nextLeadEmail !== 'all') query.set('lead_email', nextLeadEmail)
    if (nextSearch) query.set('q', nextSearch)
    query.set('page', String(nextPage))
    return `/superadmin/customers?${query.toString()}`
  }

  const loadPage = async (page: number): Promise<CustomerCache> => {
    const rows: CustomerRow[] = []
    const chunkSize = 1000

    for (let from = 0; ; from += chunkSize) {
      const { data, error } = await supabase
        .from('customers')
        .select('crl_id, customer_id, case_month, customer_name, phone_number, outstanding_amount, customer_status, visit_status, agent_email, lead_email, priority_rank, region, city, district, payment_status, assign_status, assignment_date, suspension_date, estimated_churn_date')
        .order('customer_id')
        .range(from, from + chunkSize - 1)

      if (error) throw error
      const chunk = (data ?? []) as CustomerRow[]
      rows.push(...chunk)
      if (chunk.length < chunkSize) break
    }

    const allGroups = groupCustomers(rows)

    const groupHas = (group: CustomerGroup, predicate: (row: CustomerRow) => boolean) => group.cycles.some(predicate)
    const isAssigned = (row: CustomerRow) => Boolean(row.agent_email)
    const isVisited = (row: CustomerRow) => String(row.customer_status || '').toLowerCase().includes('visited') || String(row.visit_status || '').toLowerCase() === 'visited'
    const isPaid = (row: CustomerRow) => String(row.payment_status || '').toLowerCase() === 'paid' || String(row.customer_status || '').toLowerCase().includes('paid')
    const isUnassigned = (row: CustomerRow) => !row.agent_email

    const matchesCycle = (row: CustomerRow) => {
      if (status === 'unassigned' && !isUnassigned(row)) return false
      if (status === 'assigned' && !isAssigned(row)) return false
      if (status === 'visited' && !isVisited(row)) return false
      if (status === 'paid' && !isPaid(row)) return false
      if (region !== 'all' && row.region !== region) return false
      if (leadEmail !== 'all' && row.lead_email !== leadEmail) return false
      if (safeSearch) {
        const haystack = [
          row.crl_id,
          row.customer_id,
          row.customer_name,
          row.phone_number,
          row.agent_email,
          row.lead_email,
          row.region,
          row.city,
          row.district,
        ].map((value) => String(value || '').toLowerCase()).join(' ')
        if (!haystack.includes(safeSearch)) return false
      }
      return true
    }

    const filteredGroups = allGroups
      .filter((group) => group.cycles.some(matchesCycle))
      .sort((a, b) => {
        const nameA = String(a.latest.customer_name || a.customer_id)
        const nameB = String(b.latest.customer_name || b.customer_id)
        return nameA.localeCompare(nameB)
      })

    const start = (page - 1) * PAGE_SIZE
    const paged = filteredGroups.slice(start, start + PAGE_SIZE)

    const regions = Array.from(new Set(rows.map((row) => row.region?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b))
    const leadEmails = Array.from(new Set(rows.map((row) => row.lead_email?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b))

    return {
      totalAll: allGroups.length,
      assigned: allGroups.filter((group) => groupHas(group, isAssigned)).length,
      visited: allGroups.filter((group) => groupHas(group, isVisited)).length,
      paid: allGroups.filter((group) => groupHas(group, isPaid)).length,
      unassigned: allGroups.filter((group) => groupHas(group, isUnassigned)).length,
      filteredTotal: filteredGroups.length,
      customers: paged,
      regions,
      leadEmails,
    }
  }

  let payload: CustomerCache
  try {
    const cacheRegion = encodeURIComponent(region.toLowerCase())
    const cacheLead = encodeURIComponent(leadEmail.toLowerCase())
    const cacheSearch = encodeURIComponent(safeSearch)
    payload = await cacheGetOrSet(`crl:superadmin:customers:v7-grouped:${status}:${cacheRegion}:${cacheLead}:${cacheSearch}:${requestedPage}`, CACHE_TTL, () => loadPage(requestedPage))
  } catch (error) {
    console.error('superadmin/customers:', error)
    return <div className={styles.page}><SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.customers') }]} title={t('superadmin.customers.title')} description={t('superadmin.customers.description')} /><SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.customers.errorTitle')} description={t('superadmin.customers.errorDesc')} /></div>
  }

  const totalPages = Math.max(1, Math.ceil(payload.filteredTotal / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  if (payload.filteredTotal > 0 && requestedPage !== page) redirect(buildCustomersHref(status, page, region, leadEmail, search))

  const summaries = [
    { label: tx('Unique Customers', 'Pelanggan Unik'), value: payload.totalAll, icon: UsersRound, tone: 'purple' },
    { label: tx('Assigned', 'Sudah Ditugaskan'), value: payload.assigned, icon: UserCheck, tone: 'green' },
    { label: tx('Visited', 'Sudah Dikunjungi'), value: payload.visited, icon: MapPinned, tone: 'blue' },
    { label: tx('Paid', 'Sudah Bayar'), value: payload.paid, icon: CircleDollarSign, tone: 'yellow' },
  ]

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: tx('All', 'Semua'), count: payload.totalAll },
    { key: 'unassigned', label: tx('Unassigned', 'Belum Ditugaskan'), count: payload.unassigned },
    { key: 'assigned', label: tx('Assigned', 'Ditugaskan'), count: payload.assigned },
    { key: 'visited', label: tx('Visited', 'Dikunjungi'), count: payload.visited },
    { key: 'paid', label: tx('Paid', 'Sudah Bayar'), count: payload.paid },
  ]

  const leadNameByEmail = new Map<string, string>()
  if (payload.leadEmails.length > 0) {
    const { data: leadAgents } = await supabase
      .from('agents')
      .select('email, agent_name')
      .in('email', payload.leadEmails)

    for (const agent of leadAgents ?? []) {
      if (agent.email) leadNameByEmail.set(agent.email.toLowerCase(), agent.agent_name?.trim() || agent.email)
    }
  }

  const leadOptions = payload.leadEmails
    .map((email) => ({ email, name: leadNameByEmail.get(email.toLowerCase()) || email }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const paginationParams = new URLSearchParams()
  paginationParams.set('status', status)
  if (region !== 'all') paginationParams.set('region', region)
  if (leadEmail !== 'all') paginationParams.set('lead_email', leadEmail)
  if (search) paginationParams.set('q', search)
  const paginationBasePath = `/superadmin/customers?${paginationParams.toString()}`
  const hasExtraFilters = region !== 'all' || leadEmail !== 'all' || Boolean(search)

  const formatMoney = (value: number | null) => `Rp${Number(value ?? 0).toLocaleString('id-ID')}`
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('id-ID') : '—'

  return <div className={styles.page}>
    <SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.customers') }]} title={t('superadmin.customers.title')} description={tx('Customers are grouped by Customer ID. Open a customer to see every CRL cycle linked to the same account.', 'Pelanggan dikelompokkan berdasarkan Customer ID. Buka pelanggan untuk melihat seluruh CRL cycle pada akun yang sama.')} actions={<><Link href="/superadmin/customers/upload" className={styles.addButton}><Upload aria-hidden="true" className="size-4" />{tx('Upload Data', 'Upload Data')}</Link><Link href="/superadmin/customers/new" className={styles.addButton}><UserPlus aria-hidden="true" className="size-4" />{t('superadmin.customers.addCustomer')}</Link></>} />

    <section className={styles.hero}><div><span className={styles.heroEyebrow}>{tx('Customer journey', 'Perjalanan pelanggan')}</span><h2>{tx('One customer, multiple CRL cycles.', 'Satu pelanggan, beberapa CRL cycle.')}</h2><p>{tx('The customer list is unique by Customer ID. Each CRL record stays available inside the customer card.', 'Daftar pelanggan unik berdasarkan Customer ID. Setiap record CRL tetap tersedia di dalam kartu pelanggan.')}</p></div><div className={styles.heroScene} aria-hidden="true"><span className={styles.house}>🏡</span><span className={styles.pin}>📍</span><span className={styles.tree}>🌳</span></div></section>

    <section className={styles.summaryGrid}>{summaries.map(({ label, value, icon: Icon, tone }) => <article key={label} className={`${styles.summaryCard} ${styles[`tone_${tone}`]}`}><div className={styles.summaryIcon}><Icon aria-hidden="true" /></div><strong>{value.toLocaleString('id-ID')}</strong><span>{label}</span></article>)}</section>

    <section className={styles.rosterSection}>
      <div className={styles.filterHeader}>
        <div className={styles.filterTitle}><Filter aria-hidden="true" className="size-4" /><span>{tx('Filter customers', 'Filter pelanggan')}</span></div>
        <form action="/superadmin/customers" method="get" className={styles.searchControls}>
          <input type="hidden" name="status" value={status} />
          <div className={styles.searchBox}><Search aria-hidden="true" className="size-4" /><input name="q" type="search" defaultValue={search} placeholder={tx('Search name, customer ID, CRL ID, agent, or area…', 'Cari nama, Customer ID, CRL ID, agen, atau area…')} aria-label={tx('Search customers', 'Cari pelanggan')} /></div>
          <select name="region" defaultValue={region} className={styles.regionSelect} aria-label={tx('Filter by region', 'Filter berdasarkan region')}>
            <option value="all">{tx('All regions', 'Semua region')}</option>
            {payload.regions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select name="lead_email" defaultValue={leadEmail} className={styles.regionSelect} aria-label={tx('Filter by lead', 'Filter berdasarkan lead')}>
            <option value="all">{tx('All leads', 'Semua lead')}</option>
            {leadOptions.map((lead) => <option key={lead.email} value={lead.email}>{lead.name}</option>)}
          </select>
          <button type="submit" className={styles.applyButton}>{tx('Apply', 'Terapkan')}</button>
          {hasExtraFilters && <Link href={buildCustomersHref(status, 1, 'all', 'all', '')} className={styles.clearButton}>{tx('Clear', 'Reset')}</Link>}
        </form>
        <div className={styles.filterBar}>{filters.map((item) => <Link key={item.key} href={buildCustomersHref(item.key, 1, region, leadEmail, search)} className={`${styles.filterPill} ${status === item.key ? styles.filterPillActive : ''}`}>{item.label}<span>{item.count.toLocaleString('id-ID')}</span></Link>)}</div>
      </div>

      <div className={styles.sectionHeader}><div><h2>{tx('Customer List', 'Daftar Pelanggan')}</h2><p>{tx('Each customer appears once, even if they have multiple CRL IDs.', 'Setiap pelanggan hanya muncul sekali meskipun memiliki beberapa CRL ID.')}</p></div><span>{payload.filteredTotal.toLocaleString('id-ID')} {tx('customers', 'pelanggan')}</span></div>

      {payload.customers.length === 0 ? <SuperadminState icon={Inbox} title={tx('No customers match these filters', 'Tidak ada pelanggan yang sesuai filter')} description={tx('Try another status, region, or search keyword.', 'Coba status, region, atau kata pencarian lain.')} /> : (
        <div className={styles.groupList}>
          {payload.customers.map((group, index) => {
            const customer = group.latest
            const multiple = group.cycles.length > 1
            return <details key={group.customer_id} className={styles.customerGroup} open={false}>
              <summary className={styles.customerSummary}>
                <div className={styles.customerIdentity}>
                  <span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(customer.customer_name || 'C').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <div className={styles.customerName}>{customer.customer_name || '—'}</div>
                    <div className={styles.customerId}>{group.customer_id}</div>
                  </div>
                </div>
                <div className={styles.customerMeta}>
                  <span>{customer.region || '—'}{customer.district || customer.city ? ` · ${customer.district || customer.city}` : ''}</span>
                  <span>{customer.phone_number || '—'}</span>
                </div>
                <div className={styles.customerBadges}>
                  <span className={styles.cycleBadge}>{group.cycles.length} {tx('CRL cycle', 'CRL cycle')}{group.cycles.length > 1 ? 's' : ''}</span>
                  <span className={styles.badge}>{customer.customer_status || customer.assign_status || '—'}</span>
                  {customer.priority_rank ? <span className={styles.priority}>{customer.priority_rank}</span> : null}
                </div>
                <ChevronDown className={styles.chevron} aria-hidden="true" />
              </summary>

              <div className={styles.cyclePanel}>
                <div className={styles.cycleHead}><strong>{multiple ? tx('CRL history', 'Riwayat CRL') : tx('CRL detail', 'Detail CRL')}</strong><span>{tx('Latest CRL is shown first.', 'CRL terbaru ditampilkan paling atas.')}</span></div>
                <div className={styles.cycleList}>
                  {group.cycles.map((cycle, cycleIndex) => <article key={cycle.crl_id} className={styles.cycleCard}>
                    <div className={styles.cycleTop}>
                      <div><strong>{cycle.crl_id}</strong><span>{cycle.case_month ? new Date(cycle.case_month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : (cycleIndex === 0 ? tx('Latest cycle', 'Cycle terbaru') : tx('Previous cycle', 'Cycle sebelumnya'))}</span></div>
                      <Link href={`/superadmin/customers/${encodeURIComponent(cycle.crl_id)}`} className={styles.viewButton}><Eye aria-hidden="true" className="size-4" />{tx('Open CRL', 'Buka CRL')}</Link>
                    </div>
                    <div className={styles.cycleGrid}>
                      <div><span>{tx('Agent', 'Agen')}</span><strong>{cycle.agent_email || tx('Unassigned', 'Belum ditugaskan')}</strong></div>
                      <div><span>{tx('Status', 'Status')}</span><strong>{cycle.customer_status || cycle.assign_status || '—'}</strong></div>
                      <div><span>{tx('Payment', 'Pembayaran')}</span><strong>{cycle.payment_status || '—'}</strong></div>
                      <div><span>{tx('Outstanding', 'Outstanding')}</span><strong>{formatMoney(cycle.outstanding_amount)}</strong></div>
                      <div><span>{tx('Suspension', 'Suspensi')}</span><strong>{formatDate(cycle.suspension_date)}</strong></div>
                      <div><span>{tx('Est. churn', 'Est. churn')}</span><strong>{formatDate(cycle.estimated_churn_date)}</strong></div>
                    </div>
                  </article>)}
                </div>
              </div>
            </details>
          })}
        </div>
      )}

      <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={payload.filteredTotal} basePath={paginationBasePath} />
    </section>
  </div>
}
