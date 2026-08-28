'use client'
import { useEffect,useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { Visit } from '@/lib/types'
import { dateTime } from '@/lib/format'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'

export default function AdminVisitsPage(){const[rows,setRows]=useState<Visit[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');useEffect(()=>{(async()=>{const s=createClient();const{data,error}=await s.from('visits').select('*').order('visit_date',{ascending:false});if(error)setError(error.message);else setRows((data||[])as Visit[]);setLoading(false)})()},[]);return <main className="container"><PageTop title="Visit Monitoring" eyebrow="CRL ADMIN" back/>{loading?<Loading/>:<div className="list-stack">{rows.map(v=><div className="card customer-card" key={v.visit_id}><div className="card-row"><strong>{v.visit_id}</strong><span className="status-pill">{v.visit_result||'Submitted'}</span></div><div className="muted small">{v.customer_id} · {v.agent_email}</div><div className="muted small">{dateTime(v.visit_date)}</div></div>)}</div>}{error&&<div className="card error-card">{error}</div>}</main>}
