'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'
import { useI18n } from '@/components/providers/i18n-provider'

export default function AdminCustomersPage() {
  const { t } = useI18n()
  const supabase = createClient()

  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [visitFilter, setVisitFilter] = useState('all')
  const [assignmentFilter, setAssignmentFilter] = useState('all')

  useEffect(() => {
    async function loadCustomers() {
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

      const { data: currentUser } = await supabase
        .from('agents')
        .select('role, active')
        .eq('email', email)
        .maybeSingle()

      if (
        !currentUser ||
        !currentUser.active ||
        !['admin', 'superadmin'].includes(currentUser.role)
      ) {
        window.location.href = '/auth/route'
        return
      }

      const { data, error } = await supabase
        .from('customers')
        .select(`
          customer_id,
          customer_name,
          priority_rank,
          city,
          district,
          sub_district,
          invoice_amount,
          payment_status,
          visit_status,
          customer_status,
          agent_email
        `)
        .order('priority_rank', {
          ascending: true,
        })

      if (error) {
        setError(error.message)
      } else {
        setCustomers(data ?? [])
      }

      setLoading(false)
    }

    loadCustomers()
  }, [])

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return customers.filter((customer) => {
      const matchesSearch =
        !query ||
        customer.customer_name
          ?.toLowerCase()
          .includes(query) ||
        customer.customer_id
          ?.toLowerCase()
          .includes(query) ||
        customer.agent_email
          ?.toLowerCase()
          .includes(query) ||
        customer.city
          ?.toLowerCase()
          .includes(query) ||
        customer.sub_district
          ?.toLowerCase()
          .includes(query)

      const matchesPayment =
        paymentFilter === 'all' ||
        customer.payment_status === paymentFilter

      const matchesVisit =
        visitFilter === 'all' ||
        (visitFilter === 'visited' &&
          customer.visit_status
            ?.trim()
            .toLowerCase() === 'visited') ||
        (visitFilter === 'not-visited' &&
          customer.visit_status
            ?.trim()
            .toLowerCase() !== 'visited')

      const matchesAssignment =
        assignmentFilter === 'all' ||
        (assignmentFilter === 'assigned' &&
          !!customer.agent_email) ||
        (assignmentFilter === 'unassigned' &&
          !customer.agent_email)

      return (
        matchesSearch &&
        matchesPayment &&
        matchesVisit &&
        matchesAssignment
      )
    })
  }, [
    customers,
    search,
    paymentFilter,
    visitFilter,
    assignmentFilter,
  ])

  if (loading) {
    return (
      <main className={styles.page}>
        <p>{t('admin.customers.loading')}</p>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.backButton}>
          {t('admin.back')}
        </Link>

        <div>
          <p className={styles.eyebrow}>{t('admin.customers.eyebrow')}</p>
          <h1>{t('admin.customers.title')}</h1>
          <p>{t('admin.customers.subtitle')}</p>
        </div>
      </header>

      <section className={styles.filterCard}>
        <label>
          {t('admin.customers.search')}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.customers.searchPlaceholder')}
          />
        </label>

        <div className={styles.filterGrid}>
          <label>
            {t('admin.customers.payment')}
            <select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(e.target.value)
              }
            >
              <option value="all">{t('admin.customers.all')}</option>
              <option value="paid">{t('admin.customers.paid')}</option>
              <option value="unpaid">{t('admin.customers.unpaid')}</option>
            </select>
          </label>

          <label>
            {t('admin.customers.visit')}
            <select
              value={visitFilter}
              onChange={(e) =>
                setVisitFilter(e.target.value)
              }
            >
              <option value="all">{t('admin.customers.all')}</option>
              <option value="visited">{t('admin.customers.visited')}</option>
              <option value="not-visited">
                {t('admin.customers.needVisit')}
              </option>
            </select>
          </label>

          <label>
            {t('admin.customers.assignment')}
            <select
              value={assignmentFilter}
              onChange={(e) =>
                setAssignmentFilter(e.target.value)
              }
            >
              <option value="all">{t('admin.customers.all')}</option>
              <option value="assigned">{t('admin.customers.assigned')}</option>
              <option value="unassigned">
                {t('admin.customers.unassigned')}
              </option>
            </select>
          </label>
        </div>
      </section>

      <section className={styles.resultHeader}>
        <span>{t('admin.customers.results')}</span>
        <strong>{filteredCustomers.length}</strong>
      </section>

      {error && (
        <div className={styles.errorCard}>
          {error}
        </div>
      )}

      <section className={styles.list}>
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => (
            <Link
              key={customer.customer_id}
              href={`/admin/customers/${encodeURIComponent(
                customer.customer_id
              )}`}
              className={styles.customerCard}
            >
              <div className={styles.cardTop}>
                <div>
                  <span className={styles.priority}>
                    {t('admin.customers.priority', { rank: customer.priority_rank ?? '-' })}
                  </span>

                  <h2>{customer.customer_name}</h2>
                  <p>{customer.customer_id}</p>
                </div>

                <span className={styles.arrow}>›</span>
              </div>

              <div className={styles.infoGrid}>
                <div>
                  <span>{t('admin.customers.area')}</span>
                  <strong>
                    {customer.sub_district ||
                      customer.district ||
                      customer.city ||
                      '-'}
                  </strong>
                </div>

                <div>
                  <span>{t('admin.customers.invoice')}</span>
                  <strong>
                    Rp
                    {Number(
                      customer.invoice_amount ?? 0
                    ).toLocaleString('id-ID')}
                  </strong>
                </div>

                <div>
                  <span>{t('admin.customers.payment')}</span>
                  <strong>
                    {customer.payment_status
                      ? customer.payment_status.toUpperCase()
                      : t('admin.customers.notSet')}
                  </strong>
                </div>

                <div>
                  <span>{t('admin.customers.visit')}</span>
                  <strong>
                    {customer.visit_status || t('admin.customers.notVisited')}
                  </strong>
                </div>
              </div>

              <div className={styles.assignmentRow}>
                <span>
                  {customer.agent_email
                    ? customer.agent_email
                    : t('admin.customers.notAssigned')}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className={styles.emptyState}>
            {t('admin.customers.empty')}
          </div>
        )}
      </section>
    </main>
  )
}