import Link from 'next/link'
import { AlertCircle, Eye, Inbox, UserPlus } from 'lucide-react'
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
  const page = Math.max(1, Number(params.page) || 1)
  const locale = await getLocale()
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, allMessages, key, values)
  const supabase = await createClient()

  const { data: customers, error, count } = await supabase
    .from('customers')
    .select('customer_id, customer_name, phone_number, outstanding_amount, customer_status, agent_email', { count: 'exact' })
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

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[{ label: t('superadmin.bc.superadmin'), href: '/superadmin' }, { label: t('superadmin.bc.customers') }]}
        title={t('superadmin.customers.title')}
        description={t('superadmin.customers.description')}
        actions={<Link href="/superadmin/customers/new" className={styles.addButton}><UserPlus aria-hidden="true" className="size-4" />{t('superadmin.customers.addCustomer')}</Link>}
      />

      {customers.length === 0 ? (
        <SuperadminState icon={Inbox} title={t('superadmin.customers.emptyTitle')} description={t('superadmin.customers.emptyDesc')} />
      ) : (
        <>
          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>{t('superadmin.customers.thCustomer')}</th><th>{t('superadmin.customers.thPhone')}</th><th>{t('superadmin.customers.thAssignedAgent')}</th><th>{t('superadmin.customers.thOutstanding')}</th><th>{t('superadmin.customers.thStatus')}</th><th aria-label={t('superadmin.customers.thActions')} /></tr></thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.customer_id}>
                      <td><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} className={styles.customerLink}><span className={styles.customerName}>{customer.customer_name || '—'}</span><span className={styles.customerId}>{customer.customer_id}</span></Link></td>
                      <td>{customer.phone_number || '—'}</td>
                      <td>{customer.agent_email || <span className={styles.muted}>{t('superadmin.customers.notAssigned')}</span>}</td>
                      <td className={styles.amount}>Rp{Number(customer.outstanding_amount ?? 0).toLocaleString('id-ID')}</td>
                      <td><span className={styles.badge}>{customer.customer_status || '—'}</span></td>
                      <td className={styles.actionCell}><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} aria-label={t('superadmin.customers.viewAria', { name: customer.customer_name })} title={t('superadmin.customers.viewTitle')} className={styles.iconButton}><Eye aria-hidden="true" className="size-4" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.mobileList}>
            {customers.map((customer) => (
              <article key={customer.customer_id} className={styles.mobileCard}>
                <div className={styles.mobileTop}>
                  <div><div className={styles.customerName}>{customer.customer_name || '—'}</div><div className={styles.customerId}>{customer.customer_id}</div></div>
                  <span className={styles.badge}>{customer.customer_status || '—'}</span>
                </div>
                <div className={styles.mobileInfo}>
                  <div><span>{t('superadmin.customers.thPhone')}</span><strong>{customer.phone_number || '—'}</strong></div>
                  <div><span>{t('superadmin.customers.thOutstanding')}</span><strong>Rp{Number(customer.outstanding_amount ?? 0).toLocaleString('id-ID')}</strong></div>
                  <div><span>{t('superadmin.customers.thAssignedAgent')}</span><strong>{customer.agent_email || t('superadmin.customers.notAssigned')}</strong></div>
                </div>
                <div className={styles.mobileAction}><Link href={`/superadmin/customers/${encodeURIComponent(customer.customer_id)}`} className={styles.viewButton}><Eye aria-hidden="true" className="size-4" />{t('superadmin.customers.viewTitle')}</Link></div>
              </article>
            ))}
          </div>

          <SuperadminPagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/superadmin/customers" />
        </>
      )}
    </div>
  )
}
