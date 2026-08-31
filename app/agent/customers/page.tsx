'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'

export default function AgentCustomersPage() {
  const supabase = createClient()

  const [customers, setCustomers] = useState<any[]>([])
  const [agent, setAgent] = useState<any>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

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

      const { data: agentData, error: agentError } =
        await supabase
          .from('agents')
          .select(`
            agent_name,
            sales_code,
            role,
            active
          `)
          .eq('email', email)
          .maybeSingle()

      if (
        agentError ||
        !agentData ||
        !agentData.active ||
        agentData.role !== 'agent'
      ) {
        window.location.href = '/auth/route'
        return
      }

      const { data: customerData, error: customerError } =
        await supabase
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
          .order('priority_rank', {
            ascending: true,
          })

      if (customerError) {
        setError(customerError.message)
      } else {
        setCustomers(customerData ?? [])
      }

      setAgent(agentData)
      setLoading(false)
    }

    loadData()
  }, [])

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()

    return customers.filter((customer) => {
      const matchesSearch =
        !q ||
        customer.customer_name
          ?.toLowerCase()
          .includes(q) ||
        customer.customer_id
          ?.toLowerCase()
          .includes(q) ||
        customer.city
          ?.toLowerCase()
          .includes(q) ||
        customer.district
          ?.toLowerCase()
          .includes(q) ||
        customer.sub_district
          ?.toLowerCase()
          .includes(q)

      const matchesPayment =
        paymentFilter === 'all' ||
        customer.payment_status === paymentFilter

      const matchesPriority =
        priorityFilter === 'all' ||
        String(customer.priority_rank ?? '') === priorityFilter

      return (
        matchesSearch &&
        matchesPayment &&
        matchesPriority
      )
    })
  }, [
    customers,
    search,
    paymentFilter,
    priorityFilter,
  ])

  const pendingCustomers =
    filteredCustomers.filter(
      (customer) =>
        customer.visit_status
          ?.trim()
          .toLowerCase() !== 'visited'
    )

  const visitedCustomers =
    filteredCustomers.filter(
      (customer) =>
        customer.visit_status
          ?.trim()
          .toLowerCase() === 'visited'
    )

  if (loading) {
    return (
      <main className={styles.page}>
        Loading customers...
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href="/agent"
          className={styles.backButton}
        >
          ← Back
        </Link>

        <div>
          <p className={styles.eyebrow}>
            MY CUSTOMERS
          </p>

          <h1>Assigned Customers</h1>

          <p className={styles.agentName}>
            {agent?.agent_name}
            {agent?.sales_code
              ? ` · ${agent.sales_code}`
              : ''}
          </p>
        </div>
      </header>

      <section className={styles.filterCard}>
        <label>
          Search Customer

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Name, customer ID, area..."
          />
        </label>

        <div className={styles.filterGrid}>
          <label>
            Payment

            <select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(
                  e.target.value
                )
              }
            >
              <option value="all">
                All
              </option>

              <option value="paid">
                Paid
              </option>

              <option value="unpaid">
                Unpaid
              </option>
            </select>
          </label>

          <label>
            Priority

            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(
                  e.target.value
                )
              }
            >
              <option value="all">
                All
              </option>

              <option value="1">
                Priority 1
              </option>

              <option value="2">
                Priority 2
              </option>

              <option value="3">
                Priority 3
              </option>

              <option value="4">
                Priority 4
              </option>

              <option value="5">
                Priority 5
              </option>
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Need Visit</h2>
          <span>{pendingCustomers.length}</span>
        </div>

        <div className={styles.list}>
          {pendingCustomers.length > 0 ? (
            pendingCustomers.map((customer) => (
              <CustomerCard
                key={customer.customer_id}
                customer={customer}
                visited={false}
              />
            ))
          ) : (
            <div className={styles.emptyState}>
              <h3>No pending customers</h3>
              <p>
                No customers match the current filters.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Visited</h2>
          <span>{visitedCustomers.length}</span>
        </div>

        <div className={styles.list}>
          {visitedCustomers.length > 0 ? (
            visitedCustomers.map((customer) => (
              <CustomerCard
                key={customer.customer_id}
                customer={customer}
                visited
              />
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>
                No visited customers match the current filters.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function CustomerCard({
  customer,
  visited,
}: {
  customer: any
  visited: boolean
}) {
  return (
    <Link
      href={`/agent/customers/${encodeURIComponent(
        customer.customer_id
      )}`}
      className={`${styles.customerCard} ${
        visited ? styles.visitedCard : ''
      }`}
    >
      <div className={styles.cardTop}>
        <div>
          <span className={styles.priority}>
            Priority {customer.priority_rank ?? '-'}
          </span>

          <h3>{customer.customer_name}</h3>

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
          <span>Days to Churn</span>

          <strong>
            {customer.days_left_to_churn ?? '-'}
          </strong>
        </div>
      </div>

      <div
        className={
          visited
            ? styles.visitedBadge
            : styles.pendingBadge
        }
      >
        {visited ? '✓ Visited' : 'Need Visit'}
      </div>
    </Link>
  )
}