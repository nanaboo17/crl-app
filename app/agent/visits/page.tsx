'use client'
import Link from 'next/link'
import { useEffect,useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { Visit } from '@/lib/types'
import { dateTime } from '@/lib/format'
import AgentNav from '@/components/AgentNav'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import StatusPill from '@/components/StatusPill'
import { useI18n } from '@/components/providers/i18n-provider'

export default function VisitsPage(){
 const { t } = useI18n()
 const [rows,setRows]=useState<Visit[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
 useEffect(()=>{(async()=>{const s=createClient(); const {data,error}=await s.from('visits').select('*').order('visit_date',{ascending:false}); if(error)setError(error.message); else setRows((data||[]) as Visit[]); setLoading(false)})()},[])
 return <main className="container"><PageTop title={t('agent.visits.title')}/>{loading&&<Loading/>}{error&&<div className="card error-card">{error}</div>}{!loading&&!error&&rows.length===0&&<EmptyState title={t('agent.visits.emptyTitle')} body={t('agent.visits.emptyBody')}/>}<div className="list-stack">{rows.map(r=><Link className="card customer-card" href={`/agent/visits/${encodeURIComponent(r.visit_id)}`} key={r.visit_id}><div className="card-row"><div><strong>{r.customer_id}</strong><div className="muted small">{r.visit_id}</div></div><StatusPill>{r.visit_result||t('agent.visits.submitted')}</StatusPill></div><div className="muted small">{dateTime(r.visit_date)}</div></Link>)}</div><AgentNav/></main>
}
