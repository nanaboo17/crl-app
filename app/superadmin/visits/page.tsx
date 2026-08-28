'use client'
import { useEffect,useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { Visit } from '@/lib/types'
import { dateTime } from '@/lib/format'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
export default function ManageVisits(){const[rows,setRows]=useState<Visit[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');useEffect(()=>{(async()=>{const s=createClient();const{data,error}=await s.from('visits').select('*').order('visit_date',{ascending:false});if(error)setError(error.message);else setRows((data||[])as Visit[]);setLoading(false)})()},[]);async function del(id:string){if(!confirm('Delete this visit?'))return;const s=createClient();const{error}=await s.from('visits').delete().eq('visit_id',id);if(error)setError(error.message);else setRows(r=>r.filter(x=>x.visit_id!==id))}return <main className="container"><PageTop title="Manage Visits" eyebrow="CRL SUPERADMIN" back/>{error&&<div className="inline-error">{error}</div>}{loading?<Loading/>:<div className="list-stack">{rows.map(r=><div className="card customer-card" key={r.visit_id}><div className="card-row"><strong>{r.visit_id}</strong><span className="status-pill">{r.visit_result||'Submitted'}</span></div><div className="muted small">{r.customer_id} · {r.agent_email}</div><div className="muted small">{dateTime(r.visit_date)}</div><button className="btn danger compact section-sm" onClick={()=>del(r.visit_id)}>Delete</button></div>)}</div>}</main>}
