'use client'
import { useEffect,useMemo,useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { Agent,Customer } from '@/lib/types'
import { rupiah } from '@/lib/format'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'

export default function AdminCustomersPage(){
 const [rows,setRows]=useState<Customer[]>([]); const [agents,setAgents]=useState<Agent[]>([]); const [q,setQ]=useState(''); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(''); const [error,setError]=useState('')
 async function load(){const s=createClient();const [{data:c,error:ce},{data:a,error:ae}]=await Promise.all([s.from('customers').select('*').order('customer_name'),s.from('agents').select('*').eq('role','agent').eq('active',true).order('agent_name')]);if(ce||ae)setError((ce||ae)!.message);else{setRows((c||[]) as Customer[]);setAgents((a||[]) as Agent[])}setLoading(false)}
 useEffect(()=>{load()},[])
 async function assign(customerId:string,email:string){setSaving(customerId);setError('');const s=createClient();const {error}=await s.from('customers').update({agent_email:email||null,customer_status:email?'1. Assigned':'Unassigned'}).eq('customer_id',customerId);if(error)setError(error.message);else setRows(r=>r.map(c=>c.customer_id===customerId?{...c,agent_email:email||null,customer_status:email?'1. Assigned':'Unassigned'}:c));setSaving('')}
 const filtered=useMemo(()=>rows.filter(c=>`${c.customer_name} ${c.customer_id}`.toLowerCase().includes(q.toLowerCase())),[rows,q])
 return <main className="container"><PageTop title="Customer Assignment" eyebrow="CRL ADMIN" back/><input className="input" placeholder="Search customer" value={q} onChange={e=>setQ(e.target.value)}/>{error&&<div className="inline-error section">{error}</div>}{loading?<Loading/>:<div className="list-stack">{filtered.map(c=><div className="card customer-card" key={c.customer_id}><div className="card-row"><div><strong>{c.customer_name}</strong><div className="muted small">{c.customer_id}</div></div><strong className="amount">{rupiah(c.outstanding_amount)}</strong></div><div className="field compact-field"><label>Assigned agent</label><select value={c.agent_email||''} onChange={e=>assign(c.customer_id,e.target.value)} disabled={saving===c.customer_id}><option value="">Unassigned</option>{agents.map(a=><option key={a.email} value={a.email}>{a.agent_name} · {a.sales_code}</option>)}</select></div></div>)}</div>}</main>
}
