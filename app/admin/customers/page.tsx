'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'

export default function AdminCustomersPage() {
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
        <p>Loading customers...</p>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.backButton}>
          ← Back
        </Link>

        <div>
          <p className={styles.eyebrow}>ADMIN</p>
          <h1>Customers</h1>
          <p>Search and filter customer assignments.</p>
        </div>
      </header>

      <section className={styles.filterCard}>
        <label>
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, customer ID, agent, area..."
          />
        </label>

        <div className={styles.filterGrid}>
          <label>
            Payment
            <select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(e.target.value)
              }
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>

          <label>
            Visit
            <select
              value={visitFilter}
              onChange={(e) =>
                setVisitFilter(e.target.value)
              }
            >
              <option value="all">All</option>
              <option value="visited">Visited</option>
              <option value="not-visited">
                Need Visit
              </option>
            </select>
          </label>

          <label>
            Assignment
            <select
              value={assignmentFilter}
              onChange={(e) =>
                setAssignmentFilter(e.target.value)
              }
            >
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">
                Unassigned
              </option>
            </select>
          </label>
        </div>
      </section>

      <section className={styles.resultHeader}>
        <span>Results</span>
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
                    Priority {customer.priority_rank ?? '-'}
                  </span>

                  <h2>{customer.customer_name}</h2>
                  <p>{customer.customer_id}</p>
                </div>

                <span className={styles.arrow}>›</span>
              </div>

              <div className={styles.infoGrid}>
                <div>
                  <span>Area</span>
                  <strong>
                    {customer.sub_district ||
                      customer.district ||
                      customer.city ||
                      '-'}
                  </strong>
                </div>

                <div>
                  <span>Invoice</span>
                  <strong>
                    Rp
                    {Number(
                      customer.invoice_amount ?? 0
                    ).toLocaleString('id-ID')}
                  </strong>
                </div>

                <div>
                  <span>Payment</span>
                  <strong>
                    {customer.payment_status
                      ? customer.payment_status.toUpperCase()
                      : 'NOT SET'}
                  </strong>
                </div>

                <div>
                  <span>Visit</span>
                  <strong>
                    {customer.visit_status || 'Not Visited'}
                  </strong>
                </div>
              </div>

              <div className={styles.assignmentRow}>
                <span>
                  {customer.agent_email
                    ? customer.agent_email
                    : 'Not Assigned'}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className={styles.emptyState}>
            No customers match the current filters.
          </div>
        )}
      </section>
    </main>
  )
}