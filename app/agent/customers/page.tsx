'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { Customer } from '@/lib/types'
import { rupiah } from '@/lib/format'
import AgentNav from '@/components/AgentNav'
import PageTop from '@/components/PageTop'
import StatusPill from '@/components/StatusPill'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'

export default function MyCustomersPage() {
  const [rows, setRows] = useState<Customer[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { (async () => {
    const supabase = createClient()
    const { data, error } = await supabase.from('customers').select('*').gt('outstanding_amount',0).order('outstanding_amount',{ascending:false})
    if (error) setError(error.message); else setRows((data || []) as Customer[])
    setLoading(false)
  })() }, [])

  const filtered = useMemo(() => rows.filter(c => `${c.customer_name} ${c.customer_id} ${c.phone_number ?? ''}`.toLowerCase().includes(q.toLowerCase())), [rows,q])

  return <main className="container">
    <PageTop title="My Customers"/>
    <div className="search-wrap"><input className="input" placeholder="Search name, ID, or phone" value={q} onChange={e=>setQ(e.target.value)}/></div>
    {loading && <Loading text="Loading customers…"/>}
    {error && <div className="card error-card">{error}</div>}
    {!loading && !error && filtered.length === 0 && <EmptyState title="No customers found" body="Assigned unpaid customers will appear here."/>}
    <div className="list-stack">{filtered.map(c => <Link className="card customer-card" key={c.customer_id} href={`/agent/customers/${encodeURIComponent(c.customer_id)}`}>
      <div className="card-row"><div><strong>{c.customer_name}</strong><div className="muted small">{c.customer_id}</div></div><StatusPill>{c.customer_status}</StatusPill></div>
      <div className="customer-meta"><span>{c.product || 'No product'}</span><span className="amount">{rupiah(c.outstanding_amount)}</span></div>
      <div className="muted small clamp-2">{c.service_address || 'No service address'}</div>
    </Link>)}</div>
    <AgentNav/>
  </main>
}
