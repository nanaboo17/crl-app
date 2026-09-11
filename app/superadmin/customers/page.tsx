import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, CircleDollarSign, Eye, Filter, Inbox, MapPinned, Search, UserCheck, UserPlus, UsersRound } from 'lucide-react'
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
  customer_id: string
  customer_name: string | null
  phone_number: string | null
  outstanding_amount: number | null
  customer_status: string | null
  visit_status: string | null
  agent_email: string | null
  priority_rank: string | null
  region: string | null
  city: string | null
  district: string | null
  payment_status: string | null
  assign_status: string | null
}

type CustomerCache = {
  totalAll: number
  assigned: number
  visited: number
  paid: number
  unassigned: number
  filteredTotal: number
  customers: CustomerRow[]
  regions: string[]
}

export default async function ManageCustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const requestedPage = Math.max(1, Math.floor(Number(params.page) || 1))
  const requestedStatus = typeof params.status === 'string' ? params.status.toLowerCase() : 'all'
  const status: StatusFilter = STATUS_FILTERS.includes(requestedStatus as StatusFilter) ? requestedStatus as StatusFilter : 'all'
  const region = typeof params.region === 'string' && params.region.trim() ? params.region.trim() : 'all'
  const rawSearch = typeof params.q === 'string' ? params.q.trim() : ''
  const search = rawSearch.slice(0, 100)
  const safeSearch = search.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim()
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, allMessages, key, values)
  const tx = (en: string, id: string) => locale === 'id' ? id : en
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const applyStatus = <T extends { is: Function; not: Function; neq: Function; or: Function; eq: Function }>(query: T): T => {
    if (status === 'unassigned') return query.eq('assign_status', 'unassigned') as T
    if (status === 'assigned') return query.eq('assign_status', 'assigned') as T
    if (status === 'visited') return query.or('customer_status.ilike.%visited%,visit_status.ilike.visited') as T
    if (status === 'paid') return query.or('payment_status.eq.paid,customer_status.ilike.paid') as T
    return query
  }

  const applyFilters = <T extends { is: Function; not: Function; neq: Function; or: Function; eq: Function }>(query: T): T => {
    let next = applyStatus(query)
    if (region !== 'all') next = next.eq('region', region) as T
    if (safeSearch) {
      const pattern = `%${safeSearch}%`
      next = next.or([
        `customer_id.ilike.${pattern}`,
        `customer_name.ilike.${pattern}`,
        `phone_number.ilike.${pattern}`,
        `agent_email.ilike.${pattern}`,
        `region.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `district.ilike.${pattern}`,
      ].join(',')) as T
    }
    return next
  }

  const buildCustomersHref = (nextStatus: StatusFilter = status, nextPage = 1, nextRegion = region, nextSearch = search) => {
    const query = new URLSearchParams()
    query.set('status', nextStatus)
    if (nextRegion && nextRegion !== 'all') query.set('region', nextRegion)
    if (nextSearch) query.set('q', nextSearch)
    query.set('page', String(nextPage))
    return `/superadmin/customers?${query.toString()}`
  }

  const loadPage = async (page: number): Promise<CustomerCache> => {
    const filteredCountQuery = applyFilters(
      supabase.from('customers').select('customer_id', { count: 'exact', head: true })
    )

    const [totalResult, assignedResult, visitedResult, paidResult, unassignedResult, filteredResult, regionResult] = await Promise.all([
      supabase.from('customers').select('customer_id', { count: 'exact', head: true }),
      supabase.from('customers').select('customer_id', { count: 'exact', head: true }).eq('assign_status', 'assigned'),
      supabase.from('customers').select('customer_id', { count: 'exact', head: true }).or('customer_status.ilike.%visited%,visit_status.ilike.visited'),
      supabase.from('customers').select('customer_id', { count: 'exact', head: true }).or('payment_status.eq.paid,customer_status.ilike.paid'),
      supabase.from('customers').select('customer_id', { count: 'exact', head: true }).eq('assign_status', 'unassigned'),
      filteredCountQuery,
      supabase.from('customers').select('region').not('region', 'is', null).order('region'),
    ])

    const countError = totalResult.error || assignedResult.error || visitedResult.error || paidResult.error || unassignedResult.error || filteredResult.error || regionResult.error
    if (countError) throw countError

    const baseDataQuery = supabase
      .from('customers')
      .select('customer_id, customer_name, phone_number, outstanding_amount, customer_status, visit_status, agent_email, priority_rank, region, city, district, payment_status, assign_status')
    const dataResult = await applyFilters(baseDataQuery)
      .order('customer_name')
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    if (dataResult.error) throw dataResult.error

    const regions = Array.from(new Set((regionResult.data ?? []).map((item) => item.region?.trim()).filter((value): value is string => Boolean(value))))

    return {
      totalAll: totalResult.count ?? 0,
      assigned: assignedResult.count ?? 0,
      visited: visitedResult.count ?? 0,
      paid: paidResult.count ?? 0,
      unassigned: unassignedResult.count ?? 0,
      filteredTotal: filteredResult.count ?? 0,
      customers: dataResult.data ?? [],
      regions,
    }
  }

  let payload: CustomerCache
  try {
    const cacheRegion = encodeURIComponent(region.toLowerCase())
    const cacheSearch = encodeURIComponent(safeSearch.toLowerCase())
    payload = await cacheGetOrSet(`crl:superadmin:customers:v3:${status}:${cacheRegion}:${cacheSearch}:${requestedPage}`, CACHE_TTL, () => loadPage(requestedPage))
  } catch (error) {
    console.error('superadmin/customers:', error)
    return <div className={styles.page}><SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.customers') }]} title={t('superadmin.customers.title')} description={t('superadmin.customers.description')} /><SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.customers.errorTitle')} description={t('superadmin.customers.errorDesc')} /></div>
  }

  const totalPages = Math.max(1, Math.ceil(payload.filteredTotal / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  if (payload.filteredTotal > 0 && requestedPage !== page) redirect(buildCustomersHref(status, page, region, search))

  const summaries = [
    { label: tx('All Customers', 'Semua Pelanggan'), value: payload.totalAll, icon: UsersRound, tone: 'purple' },
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

  const paginationParams = new URLSearchParams()
  paginationParams.set('status', status)
  if (region !== 'all') paginationParams.set('region', region)
  if (search) paginationParams.set('q', search)
  const paginationBasePath = `/superadmin/customers?${paginationParams.toString()}`
  const hasExtraFilters = region !== 'all' || Boolean(search)

  return <div className={styles.page}>
    <SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.customers') }]} title={t('superadmin.customers.title')} description={tx('View the complete CRL customer base and filter by assignment, visit, payment status, and region.', 'Lihat seluruh basis pelanggan CRL dan filter berdasarkan status penugasan, kunjungan, pembayaran, dan region.')} actions={<Link href="/superadmin/customers/new" className={styles.addButton}><UserPlus aria-hidden="true" className="size-4" />{t('superadmin.customers.addCustomer')}</Link>} />
    <section className={styles.hero}><div><span className={styles.heroEyebrow}>{tx('Customer journey', 'Perjalanan pelanggan')}</span><h2>{tx('See every customer stage in one place.', 'Lihat setiap tahap pelanggan dalam satu tempat.')}</h2><p>{tx('Use status, region, and search filters to quickly find the customers you need.', 'Gunakan filter status, region, dan pencarian untuk menemukan pelanggan dengan cepat.')}</p></div><div className={styles.heroScene} aria-hidden="true"><span className={styles.house}>🏡</span><span className={styles.pin}>📍</span><span className={styles.tree}>🌳</span></div></section>
    <section className={styles.summaryGrid}>{summaries.map(({ label, value, icon: Icon, tone }) => <article key={label} className={`${styles.summaryCard} ${styles[`tone_${tone}`]}`}><div className={styles.summaryIcon}><Icon aria-hidden="true" /></div><strong>{value.toLocaleString('id-ID')}</strong><span>{label}</span></article>)}</section>
    <section className={styles.rosterSection}>
      <div className={styles.filterHeader}>
        <div className={styles.filterTitle}><Filter aria-hidden="true" className="size-4" /><span>{tx('Filter customers', 'Filter pelanggan')}</span></div>
        <form action="/superadmin/customers" method="get" className={styles.searchControls}>
          <input type="hidden" name="status" value={status} />
          <div className={styles.searchBox}><Search aria-hidden="true" className="size-4" /><input name="q" type="search" defaultValue={search} placeholder={tx('Search name, customer ID, phone, agent, or area…', 'Cari nama, ID pelanggan, telepon, agen, atau area…')} aria-label={tx('Search customers', 'Cari pelanggan')} /></div>
          <select name="region" defaultValue={region} className={styles.regionSelect} aria-label={tx('Filter by region', 'Filter berdasarkan region')}>
            <option value="all">{tx('All regions', 'Semua region')}</option>
            {payload.regions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="submit" className={styles.applyButton}>{tx('Apply', 'Terapkan')}</button>
          {hasExtraFilters && <Link href={buildCustomersHref(status, 1, 'all', '')} className={styles.clearButton}>{tx('Clear', 'Reset')}</Link>}
        </form>
        <div className={styles.filterBar}>{filters.map((item) => <Link key={item.key} href={buildCustomersHref(item.key, 1, region, search)} className={`${styles.filterPill} ${status === item.key ? styles.filterPillActive : ''}`}>{item.label}<span>{item.count.toLocaleString('id-ID')}</span></Link>)}</div>
      </div>
      <div className={styles.sectionHeader}><div><h2>{tx('Customer List', 'Daftar Pelanggan')}</h2><p>{tx('Open a customer to review details and field history.', 'Buka pelanggan untuk melihat detail dan riwayat lapangan.')}</p></div><span>{payload.filteredTotal.toLocaleString('id-ID')} {tx('customers', 'pelanggan')}</span></div>
      {payload.customers.length === 0 ? <SuperadminState icon={Inbox} title={tx('No customers match these filters', 'Tidak ada pelanggan yang sesuai filter')} description={tx('Try another status, region, or search keyword.', 'Coba status, region, atau kata pencarian lain.')} /> : <>
        <div className={styles.tableCard}><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>{t('superadmin.customers.thCustomer')}</th><th>{tx('Region / Area', 'Region / Area')}</th><th>{t('superadmin.customers.thPhone')}</th><th>{t('superadmin.customers.thAssignedAgent')}</th><th>{t('superadmin.customers.thOutstanding')}</th><th>{t('superadmin.customers.thStatus')}</th><th aria-label={t('superadmin.customers.thActions')} /></tr></thead><tbody>{payload.customers.map((customer, index) => <tr key={customer.customer_id}><td><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} className={styles.customerLink}><span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(customer.customer_name || 'C').slice(0, 1).toUpperCase()}</span><span><span className={styles.customerName}>{customer.customer_name || '—'}</span><span className={styles.customerId}>{customer.customer_id}</span></span></Link></td><td><span className={styles.area}>{customer.region || '—'}{customer.district || customer.city ? ` · ${customer.district || customer.city}` : ''}</span></td><td>{customer.phone_number || '—'}</td><td>{customer.agent_email || <span className={styles.muted}>{t('superadmin.customers.notAssigned')}</span>}</td><td className={styles.amount}>Rp{Number(customer.outstanding_amount ?? 0).toLocaleString('id-ID')}</td><td><div className={styles.statusStack}><span className={styles.badge}>{customer.customer_status || customer.assign_status || '—'}</span>{customer.priority_rank ? <span className={styles.priority}>{customer.priority_rank}</span> : null}</div></td><td className={styles.actionCell}><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} aria-label={t('superadmin.customers.viewAria', { name: customer.customer_name || customer.customer_id })} title={t('superadmin.customers.viewTitle')} className={styles.iconButton}><Eye aria-hidden="true" className="size-4" /></Link></td></tr>)}</tbody></table></div></div>
        <div className={styles.mobileList}>{payload.customers.map((customer, index) => <article key={customer.customer_id} className={styles.mobileCard}><div className={styles.mobileTop}><div className={styles.mobileIdentity}><span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(customer.customer_name || 'C').slice(0, 1).toUpperCase()}</span><div><div className={styles.customerName}>{customer.customer_name || '—'}</div><div className={styles.customerId}>{customer.customer_id}</div></div></div><div className={styles.statusStack}><span className={styles.badge}>{customer.customer_status || customer.assign_status || '—'}</span>{customer.priority_rank ? <span className={styles.priority}>{customer.priority_rank}</span> : null}</div></div><div className={styles.mobileInfo}><div><span>{tx('Region', 'Region')}</span><strong>{customer.region || '—'}</strong></div><div><span>{tx('Area', 'Area')}</span><strong>{customer.district || customer.city || '—'}</strong></div><div><span>{t('superadmin.customers.thPhone')}</span><strong>{customer.phone_number || '—'}</strong></div><div><span>{t('superadmin.customers.thOutstanding')}</span><strong>Rp{Number(customer.outstanding_amount ?? 0).toLocaleString('id-ID')}</strong></div><div><span>{t('superadmin.customers.thAssignedAgent')}</span><strong>{customer.agent_email || t('superadmin.customers.notAssigned')}</strong></div></div><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} className={styles.viewButton}><Eye aria-hidden="true" className="size-4" />{t('superadmin.customers.viewTitle')}</Link></article>)}</div>
        <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={payload.filteredTotal} basePath={paginationBasePath} />
      </>}
    </section>
  </div>
}
