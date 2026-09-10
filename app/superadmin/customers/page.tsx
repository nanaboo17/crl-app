import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, CircleDollarSign, Eye, Filter, Inbox, MapPinned, UserCheck, UserPlus, UsersRound } from 'lucide-react'
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
}

export default async function ManageCustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const requestedPage = Math.max(1, Math.floor(Number(params.page) || 1))
  const requestedStatus = typeof params.status === 'string' ? params.status.toLowerCase() : 'all'
  const status: StatusFilter = STATUS_FILTERS.includes(requestedStatus as StatusFilter) ? requestedStatus as StatusFilter : 'all'
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, allMessages, key, values)
  const tx = (en: string, id: string) => locale === 'id' ? id : en
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const applyStatus = <T extends { is: Function; not: Function; neq: Function; or: Function }>(query: T): T => {
    if (status === 'unassigned') return query.is('agent_email', null).neq('payment_status', 'paid') as T
    if (status === 'assigned') return query.not('agent_email', 'is', null).neq('payment_status', 'paid') as T
    if (status === 'visited') return query.or('customer_status.ilike.%visited%,visit_status.ilike.visited') as T
    if (status === 'paid') return query.or('payment_status.eq.paid,customer_status.ilike.paid') as T
    return query
  }

  const loadPage = async (page: number): Promise<CustomerCache> => {
    const filteredCountQuery = applyStatus(
      supabase.from('customers').select('customer_id', { count: 'exact', head: true })
    )

    const [totalResult, assignedResult, visitedResult, paidResult, unassignedResult, filteredResult] = await Promise.all([
      supabase.from('customers').select('customer_id', { count: 'exact', head: true }),
      supabase.from('customers').select('customer_id', { count: 'exact', head: true }).not('agent_email', 'is', null),
      supabase.from('customers').select('customer_id', { count: 'exact', head: true }).or('customer_status.ilike.%visited%,visit_status.ilike.visited'),
      supabase.from('customers').select('customer_id', { count: 'exact', head: true }).or('payment_status.eq.paid,customer_status.ilike.paid'),
      supabase.from('customers').select('customer_id', { count: 'exact', head: true }).eq('assign_status', 'unassigned').neq('payment_status', 'paid'),
      filteredCountQuery,
    ])

    const countError = totalResult.error || assignedResult.error || visitedResult.error || paidResult.error || unassignedResult.error || filteredResult.error
    if (countError) throw countError

    const baseDataQuery = supabase
      .from('customers')
      .select('customer_id, customer_name, phone_number, outstanding_amount, customer_status, visit_status, agent_email, priority_rank, city, district, payment_status, assign_status')
    const dataResult = await applyStatus(baseDataQuery)
      .order('customer_name')
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    if (dataResult.error) throw dataResult.error

    return {
      totalAll: totalResult.count ?? 0,
      assigned: assignedResult.count ?? 0,
      visited: visitedResult.count ?? 0,
      paid: paidResult.count ?? 0,
      unassigned: unassignedResult.count ?? 0,
      filteredTotal: filteredResult.count ?? 0,
      customers: dataResult.data ?? [],
    }
  }

  let payload: CustomerCache
  try {
    payload = await cacheGetOrSet(`crl:superadmin:customers:v2:${status}:${requestedPage}`, CACHE_TTL, () => loadPage(requestedPage))
  } catch (error) {
    console.error('superadmin/customers:', error)
    return <div className={styles.page}><SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.customers') }]} title={t('superadmin.customers.title')} description={t('superadmin.customers.description')} /><SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.customers.errorTitle')} description={t('superadmin.customers.errorDesc')} /></div>
  }

  const totalPages = Math.max(1, Math.ceil(payload.filteredTotal / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  if (payload.filteredTotal > 0 && requestedPage !== page) redirect(`/superadmin/customers?status=${status}&page=${page}`)

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

  return <div className={styles.page}>
    <SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.customers') }]} title={t('superadmin.customers.title')} description={tx('View the complete CRL customer base and filter by assignment, visit, and payment status.', 'Lihat seluruh basis pelanggan CRL dan filter berdasarkan status penugasan, kunjungan, dan pembayaran.')} actions={<Link href="/superadmin/customers/new" className={styles.addButton}><UserPlus aria-hidden="true" className="size-4" />{t('superadmin.customers.addCustomer')}</Link>} />
    <section className={styles.hero}><div><span className={styles.heroEyebrow}>{tx('Customer journey', 'Perjalanan pelanggan')}</span><h2>{tx('See every customer stage in one place.', 'Lihat setiap tahap pelanggan dalam satu tempat.')}</h2><p>{tx('Use the status filters to review unassigned, assigned, visited, and paid customers without losing historical visibility.', 'Gunakan filter status untuk melihat pelanggan belum ditugaskan, sudah ditugaskan, sudah dikunjungi, dan sudah bayar tanpa kehilangan histori.')}</p></div><div className={styles.heroScene} aria-hidden="true"><span className={styles.house}>🏡</span><span className={styles.pin}>📍</span><span className={styles.tree}>🌳</span></div></section>
    <section className={styles.summaryGrid}>{summaries.map(({ label, value, icon: Icon, tone }) => <article key={label} className={`${styles.summaryCard} ${styles[`tone_${tone}`]}`}><div className={styles.summaryIcon}><Icon aria-hidden="true" /></div><strong>{value.toLocaleString('id-ID')}</strong><span>{label}</span></article>)}</section>
    <section className={styles.rosterSection}>
      <div className={styles.filterHeader}><div className={styles.filterTitle}><Filter aria-hidden="true" className="size-4" /><span>{tx('Filter customers', 'Filter pelanggan')}</span></div><div className={styles.filterBar}>{filters.map((item) => <Link key={item.key} href={`/superadmin/customers?status=${item.key}&page=1`} className={`${styles.filterPill} ${status === item.key ? styles.filterPillActive : ''}`}>{item.label}<span>{item.count.toLocaleString('id-ID')}</span></Link>)}</div></div>
      <div className={styles.sectionHeader}><div><h2>{tx('Customer List', 'Daftar Pelanggan')}</h2><p>{tx('Open a customer to review details and field history.', 'Buka pelanggan untuk melihat detail dan riwayat lapangan.')}</p></div><span>{payload.filteredTotal.toLocaleString('id-ID')} {tx('customers', 'pelanggan')}</span></div>
      {payload.customers.length === 0 ? <SuperadminState icon={Inbox} title={tx('No customers in this filter', 'Tidak ada pelanggan pada filter ini')} description={tx('Choose another status filter.', 'Pilih filter status lain.')} /> : <>
        <div className={styles.tableCard}><div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>{t('superadmin.customers.thCustomer')}</th><th>{tx('Area', 'Area')}</th><th>{t('superadmin.customers.thPhone')}</th><th>{t('superadmin.customers.thAssignedAgent')}</th><th>{t('superadmin.customers.thOutstanding')}</th><th>{t('superadmin.customers.thStatus')}</th><th aria-label={t('superadmin.customers.thActions')} /></tr></thead><tbody>{payload.customers.map((customer, index) => <tr key={customer.customer_id}><td><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} className={styles.customerLink}><span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(customer.customer_name || 'C').slice(0, 1).toUpperCase()}</span><span><span className={styles.customerName}>{customer.customer_name || '—'}</span><span className={styles.customerId}>{customer.customer_id}</span></span></Link></td><td><span className={styles.area}>{customer.district || customer.city || '—'}</span></td><td>{customer.phone_number || '—'}</td><td>{customer.agent_email || <span className={styles.muted}>{t('superadmin.customers.notAssigned')}</span>}</td><td className={styles.amount}>Rp{Number(customer.outstanding_amount ?? 0).toLocaleString('id-ID')}</td><td><div className={styles.statusStack}><span className={styles.badge}>{customer.customer_status || customer.assign_status || '—'}</span>{customer.priority_rank ? <span className={styles.priority}>{customer.priority_rank}</span> : null}</div></td><td className={styles.actionCell}><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} aria-label={t('superadmin.customers.viewAria', { name: customer.customer_name || customer.customer_id })} title={t('superadmin.customers.viewTitle')} className={styles.iconButton}><Eye aria-hidden="true" className="size-4" /></Link></td></tr>)}</tbody></table></div></div>
        <div className={styles.mobileList}>{payload.customers.map((customer, index) => <article key={customer.customer_id} className={styles.mobileCard}><div className={styles.mobileTop}><div className={styles.mobileIdentity}><span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(customer.customer_name || 'C').slice(0, 1).toUpperCase()}</span><div><div className={styles.customerName}>{customer.customer_name || '—'}</div><div className={styles.customerId}>{customer.customer_id}</div></div></div><div className={styles.statusStack}><span className={styles.badge}>{customer.customer_status || customer.assign_status || '—'}</span>{customer.priority_rank ? <span className={styles.priority}>{customer.priority_rank}</span> : null}</div></div><div className={styles.mobileInfo}><div><span>{tx('Area', 'Area')}</span><strong>{customer.district || customer.city || '—'}</strong></div><div><span>{t('superadmin.customers.thPhone')}</span><strong>{customer.phone_number || '—'}</strong></div><div><span>{t('superadmin.customers.thOutstanding')}</span><strong>Rp{Number(customer.outstanding_amount ?? 0).toLocaleString('id-ID')}</strong></div><div><span>{t('superadmin.customers.thAssignedAgent')}</span><strong>{customer.agent_email || t('superadmin.customers.notAssigned')}</strong></div></div><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} className={styles.viewButton}><Eye aria-hidden="true" className="size-4" />{t('superadmin.customers.viewTitle')}</Link></article>)}</div>
        <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={payload.filteredTotal} basePath={`/superadmin/customers?status=${status}`} />
      </>}
    </section>
  </div>
}
