'use client'
import { useEffect,useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { PreVisit } from '@/lib/types'
import { dateTime } from '@/lib/format'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
export default function ManagePreVisits(){const[rows,setRows]=useState<PreVisit[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');useEffect(()=>{(async()=>{const s=createClient();const{data,error}=await s.from('pre_visits').select('*').order('created_at',{ascending:false});if(error)setError(error.message);else setRows((data||[])as PreVisit[]);setLoading(false)})()},[]);async function del(id:string){if(!confirm('Delete this pre-visit?'))return;const s=createClient();const{error}=await s.from('pre_visits').delete().eq('previsit_id',id);if(error)setError(error.message);else setRows(r=>r.filter(x=>x.previsit_id!==id))}return <main className="container"><PageTop title="Manage Pre-Visits" eyebrow="CRL SUPERADMIN" back/>{error&&<div className="inline-error">{error}</div>}{loading?<Loading/>:<div className="list-stack">{rows.map(r=><div className="card customer-card" key={r.previsit_id}><div className="card-row"><strong>{r.previsit_id}</strong><span className="status-pill">{r.previsit_status}</span></div><div className="muted small">{r.customer_id} · {r.agent_email}</div><div className="muted small">{dateTime(r.appointment_date)}</div><button className="btn danger compact section-sm" onClick={()=>del(r.previsit_id)}>Delete</button></div>)}</div>}</main>}
