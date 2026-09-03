import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, Eye, Inbox, MapPinned, UserCheck, UserPlus, UsersRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'
import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'
import styles from './page.module.css'

const PAGE_SIZE = 10

export default async function ManageCustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const requestedPage = Math.max(1, Math.floor(Number(params.page) || 1))
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, allMessages, key, values)
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = await createClient()

  const [totalResult, assignedResult, visitedResult, priorityResult] = await Promise.all([
    supabase.from('customers').select('customer_id', { count: 'exact', head: true }),
    supabase.from('customers').select('customer_id', { count: 'exact', head: true }).not('agent_email', 'is', null),
    supabase.from('customers').select('customer_id', { count: 'exact', head: true }).eq('visit_status', 'Visited'),
    supabase.from('customers').select('customer_id', { count: 'exact', head: true }).lte('priority_rank', 2),
  ])

  const countError = totalResult.error || assignedResult.error || visitedResult.error || priorityResult.error
  if (countError) {
    console.error('superadmin/customers count:', countError.message)
    return (
      <div className={styles.page}>
        <SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.customers') }]} title={t('superadmin.customers.title')} description={t('superadmin.customers.description')} />
        <SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.customers.errorTitle')} description={t('superadmin.customers.errorDesc')} />
      </div>
    )
  }

  const total = totalResult.count ?? 0
  const assigned = assignedResult.count ?? 0
  const visited = visitedResult.count ?? 0
  const priority = priorityResult.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)

  if (total > 0 && requestedPage !== page) redirect(`/superadmin/customers?page=${page}`)

  const { data: customers, error } = await supabase
    .from('customers')
    .select('customer_id, customer_name, phone_number, outstanding_amount, customer_status, visit_status, agent_email, priority_rank, city, district')
    .order('customer_name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (error) {
    console.error('superadmin/customers:', error.message)
    return (
      <div className={styles.page}>
        <SuperadminPageHeader breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.customers') }]} title={t('superadmin.customers.title')} description={t('superadmin.customers.description')} />
        <SuperadminState tone="error" icon={AlertCircle} title={t('superadmin.customers.errorTitle')} description={t('superadmin.customers.errorDesc')} />
      </div>
    )
  }

  const summaries = [
    { label: tx('Total Customers', 'Total Pelanggan'), value: total, icon: UsersRound, tone: 'purple' },
    { label: tx('Assigned', 'Sudah Ditugaskan'), value: assigned, icon: UserCheck, tone: 'green' },
    { label: tx('Visited', 'Sudah Dikunjungi'), value: visited, icon: MapPinned, tone: 'blue' },
    { label: tx('Priority 1–2', 'Prioritas 1–2'), value: priority, icon: AlertCircle, tone: 'yellow' },
  ]

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.customers') }]}
        title={t('superadmin.customers.title')}
        description={t('superadmin.customers.description')}
        actions={<Link href="/superadmin/customers/new" className={styles.addButton}><UserPlus aria-hidden="true" className="size-4" />{t('superadmin.customers.addCustomer')}</Link>}
      />

      <section className={styles.hero}>
        <div>
          <span className={styles.heroEyebrow}>{tx('Customer journey', 'Perjalanan pelanggan')}</span>
          <h2>{tx('Keep every customer visible and moving forward.', 'Pastikan setiap pelanggan terlihat dan terus bergerak maju.')}</h2>
          <p>{tx('Track assignments, field progress, and high-priority customers from one place.', 'Pantau penugasan, progres lapangan, dan pelanggan prioritas tinggi dari satu tempat.')}</p>
        </div>
        <div className={styles.heroScene} aria-hidden="true">
          <span className={styles.house}>🏡</span><span className={styles.pin}>📍</span><span className={styles.tree}>🌳</span>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label={tx('Customer summary', 'Ringkasan pelanggan')}>
        {summaries.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className={`${styles.summaryCard} ${styles[`tone_${tone}`]}`}>
            <div className={styles.summaryIcon}><Icon aria-hidden="true" /></div>
            <strong>{value.toLocaleString('id-ID')}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>

      {customers.length === 0 ? (
        <SuperadminState icon={Inbox} title={t('superadmin.customers.emptyTitle')} description={t('superadmin.customers.emptyDesc')} />
      ) : (
        <section className={styles.rosterSection}>
          <div className={styles.sectionHeader}>
            <div><h2>{tx('Customer List', 'Daftar Pelanggan')}</h2><p>{tx('Open a customer to review details and field history.', 'Buka pelanggan untuk melihat detail dan riwayat lapangan.')}</p></div>
            <span>{total.toLocaleString('id-ID')} {tx('customers', 'pelanggan')}</span>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>{t('superadmin.customers.thCustomer')}</th><th>{tx('Area', 'Area')}</th><th>{t('superadmin.customers.thPhone')}</th><th>{t('superadmin.customers.thAssignedAgent')}</th><th>{t('superadmin.customers.thOutstanding')}</th><th>{t('superadmin.customers.thStatus')}</th><th aria-label={t('superadmin.customers.thActions')} /></tr></thead>
                <tbody>
                  {customers.map((customer, index) => (
                    <tr key={customer.customer_id}>
                      <td><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} className={styles.customerLink}><span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(customer.customer_name || 'C').slice(0, 1).toUpperCase()}</span><span><span className={styles.customerName}>{customer.customer_name || '—'}</span><span className={styles.customerId}>{customer.customer_id}</span></span></Link></td>
                      <td><span className={styles.area}>{customer.district || customer.city || '—'}</span></td>
                      <td>{customer.phone_number || '—'}</td>
                      <td>{customer.agent_email || <span className={styles.muted}>{t('superadmin.customers.notAssigned')}</span>}</td>
                      <td className={styles.amount}>Rp{Number(customer.outstanding_amount ?? 0).toLocaleString('id-ID')}</td>
                      <td><div className={styles.statusStack}><span className={styles.badge}>{customer.customer_status || '—'}</span>{customer.priority_rank ? <span className={styles.priority}>P{customer.priority_rank}</span> : null}</div></td>
                      <td className={styles.actionCell}><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} aria-label={t('superadmin.customers.viewAria', { name: customer.customer_name })} title={t('superadmin.customers.viewTitle')} className={styles.iconButton}><Eye aria-hidden="true" className="size-4" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.mobileList}>
            {customers.map((customer, index) => (
              <article key={customer.customer_id} className={styles.mobileCard}>
                <div className={styles.mobileTop}><div className={styles.mobileIdentity}><span className={`${styles.avatar} ${styles[`avatar${index % 4}`]}`}>{(customer.customer_name || 'C').slice(0, 1).toUpperCase()}</span><div><div className={styles.customerName}>{customer.customer_name || '—'}</div><div className={styles.customerId}>{customer.customer_id}</div></div></div><div className={styles.statusStack}><span className={styles.badge}>{customer.customer_status || '—'}</span>{customer.priority_rank ? <span className={styles.priority}>P{customer.priority_rank}</span> : null}</div></div>
                <div className={styles.mobileInfo}><div><span>{tx('Area', 'Area')}</span><strong>{customer.district || customer.city || '—'}</strong></div><div><span>{t('superadmin.customers.thPhone')}</span><strong>{customer.phone_number || '—'}</strong></div><div><span>{t('superadmin.customers.thOutstanding')}</span><strong>Rp{Number(customer.outstanding_amount ?? 0).toLocaleString('id-ID')}</strong></div><div><span>{t('superadmin.customers.thAssignedAgent')}</span><strong>{customer.agent_email || t('superadmin.customers.notAssigned')}</strong></div></div>
                <Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} className={styles.viewButton}><Eye aria-hidden="true" className="size-4" />{t('superadmin.customers.viewTitle')}</Link>
              </article>
            ))}
          </div>

          <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/superadmin/customers" />
        </section>
      )}
    </div>
  )
}
