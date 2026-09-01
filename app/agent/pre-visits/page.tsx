'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { PreVisit } from '@/lib/types'
import { dateTime } from '@/lib/format'
import AgentNav from '@/components/AgentNav'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import StatusPill from '@/components/StatusPill'
import { useI18n } from '@/components/providers/i18n-provider'

export default function PreVisitsPage(){
 const { t } = useI18n()
 const [rows,setRows]=useState<PreVisit[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
 useEffect(()=>{(async()=>{const s=createClient(); const {data,error}=await s.from('pre_visits').select('*').order('created_at',{ascending:false}); if(error)setError(error.message); else setRows((data||[]) as PreVisit[]); setLoading(false)})()},[])
 return <main className="container"><PageTop title={t('agent.preVisits.title')}/>{loading&&<Loading/>}{error&&<div className="card error-card">{error}</div>}{!loading&&!error&&rows.length===0&&<EmptyState title={t('agent.preVisits.emptyTitle')} body={t('agent.preVisits.emptyBody')}/>}<div className="list-stack">{rows.map(r=><Link className="card customer-card" href={`/agent/pre-visits/${encodeURIComponent(r.previsit_id)}`} key={r.previsit_id}><div className="card-row"><div><strong>{r.customer_id}</strong><div className="muted small">{r.previsit_id}</div></div><StatusPill>{r.previsit_status}</StatusPill></div><div className="muted small">{t('agent.preVisits.appointment', { date: dateTime(r.appointment_date) })}</div></Link>)}</div><AgentNav/></main>
}
