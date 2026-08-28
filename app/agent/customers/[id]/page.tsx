'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { Customer, PreVisit, Visit } from '@/lib/types'
import { dateOnly, rupiah } from '@/lib/format'
import AgentNav from '@/components/AgentNav'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import StatusPill from '@/components/StatusPill'

export default function CustomerDetailPage() {
  const params = useParams<{id:string}>()
  const id = decodeURIComponent(params.id)
  const [customer,setCustomer]=useState<Customer|null>(null)
  const [pre,setPre]=useState<PreVisit|null>(null)
  const [visit,setVisit]=useState<Visit|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{ (async()=>{
    const supabase=createClient()
    const [{data:c,error:ce},{data:p},{data:v}] = await Promise.all([
      supabase.from('customers').select('*').eq('customer_id',id).single(),
      supabase.from('pre_visits').select('*').eq('customer_id',id).maybeSingle(),
      supabase.from('visits').select('*').eq('customer_id',id).maybeSingle(),
    ])
    if(ce) setError(ce.message); else setCustomer(c as Customer)
    setPre((p||null) as PreVisit|null); setVisit((v||null) as Visit|null); setLoading(false)
  })() },[id])

  if(loading) return <main className="container"><PageTop title="Customer" back/><Loading/></main>
  if(error || !customer) return <main className="container"><PageTop title="Customer" back/><div className="card error-card">{error || 'Customer not found'}</div></main>

  return <main className="container">
    <PageTop title={customer.customer_name} back/>
    <section className="card">
      <div className="card-row"><div><div className="muted small">CUSTOMER ID</div><strong>{customer.customer_id}</strong></div><StatusPill>{customer.customer_status}</StatusPill></div>
      <div className="detail-grid">
        <div><span>Phone</span><strong>{customer.phone_number || '—'}</strong></div>
        <div><span>Product</span><strong>{customer.product || '—'}</strong></div>
        <div><span>Outstanding</span><strong>{rupiah(customer.outstanding_amount)}</strong></div>
        <div><span>Unpaid since</span><strong>{dateOnly(customer.unpaid_since)}</strong></div>
      </div>
      <div className="detail-block"><span>Service address</span><p>{customer.service_address || '—'}</p></div>
    </section>

    <section className="section"><h2 className="section-title">Workflow</h2><div className="actions">
      {!pre && !visit && <Link className="btn" href={`/agent/pre-visits/new?customer=${encodeURIComponent(id)}`}>Start Pre-Visit</Link>}
      {pre && <Link className="btn secondary" href={`/agent/pre-visits/${encodeURIComponent(pre.previsit_id)}`}>View Pre-Visit</Link>}
      {pre?.previsit_status === 'Ready for Visit' && !visit && <Link className="btn" href={`/agent/visits/new?customer=${encodeURIComponent(id)}`}>Start Visit</Link>}
      {visit && <Link className="btn secondary" href={`/agent/visits/${encodeURIComponent(visit.visit_id)}`}>View Visit</Link>}
    </div></section>
    <AgentNav/>
  </main>
}
