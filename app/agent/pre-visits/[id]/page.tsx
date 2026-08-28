'use client'
import Link from 'next/link'
import { useEffect,useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { PreVisit, Customer } from '@/lib/types'
import { dateTime } from '@/lib/format'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import StatusPill from '@/components/StatusPill'

export default function PreVisitDetailPage(){
 const params=useParams<{id:string}>(); const id=decodeURIComponent(params.id); const [row,setRow]=useState<PreVisit|null>(null); const [customer,setCustomer]=useState<Customer|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
 useEffect(()=>{(async()=>{const s=createClient(); const {data,error}=await s.from('pre_visits').select('*').eq('previsit_id',id).single(); if(error){setError(error.message);setLoading(false);return} setRow(data as PreVisit); const {data:c}=await s.from('customers').select('*').eq('customer_id',data.customer_id).single(); setCustomer((c||null) as Customer|null); setLoading(false)})()},[id])
 if(loading)return <main className="container"><PageTop title="Pre-Visit" back/><Loading/></main>
 if(error||!row)return <main className="container"><PageTop title="Pre-Visit" back/><div className="card error-card">{error||'Not found'}</div></main>
 return <main className="container"><PageTop title="Pre-Visit Detail" back/>
  <section className="card"><div className="card-row"><div><strong>{customer?.customer_name||row.customer_id}</strong><div className="muted small">{row.previsit_id}</div></div><StatusPill>{row.previsit_status}</StatusPill></div>
  <div className="detail-grid"><div><span>Contact confirmed</span><strong>{row.contact_confirmed?'Yes':'No'}</strong></div><div><span>Address confirmed</span><strong>{row.address_confirmed?'Yes':'No'}</strong></div><div><span>Appointment</span><strong>{dateTime(row.appointment_date)}</strong></div><div><span>Contact result</span><strong>{row.contact_result||'—'}</strong></div></div>
  <div className="detail-block"><span>Address / landmark</span><p>{row.confirmed_address||customer?.service_address||'—'}{row.landmark?` · ${row.landmark}`:''}</p></div><div className="detail-block"><span>Notes</span><p>{row.previsit_notes||'—'}</p></div></section>
  {row.previsit_status==='Ready for Visit'&&<section className="section"><Link className="btn" href={`/agent/visits/new?customer=${encodeURIComponent(row.customer_id)}`}>Start Visit</Link></section>}
 </main>
}
