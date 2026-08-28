'use client'
import Link from 'next/link'
import { useEffect,useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getCurrentProfile } from '@/lib/auth'
import type { Agent } from '@/lib/types'
import Loading from '@/components/Loading'

export default function AdminDashboard(){
 const [profile,setProfile]=useState<Agent|null>(null); const [counts,setCounts]=useState({total:0,assigned:0,unassigned:0,visits:0}); const [error,setError]=useState('')
 useEffect(()=>{(async()=>{try{const p=await getCurrentProfile(); if(p.role!=='admin') return window.location.replace(p.role==='superadmin'?'/superadmin':'/agent'); setProfile(p); const s=createClient(); const [{count:total},{count:assigned},{count:unassigned},{count:visits}] = await Promise.all([s.from('customers').select('*',{count:'exact',head:true}),s.from('customers').select('*',{count:'exact',head:true}).not('agent_email','is',null),s.from('customers').select('*',{count:'exact',head:true}).is('agent_email',null),s.from('visits').select('*',{count:'exact',head:true})]);setCounts({total:total||0,assigned:assigned||0,unassigned:unassigned||0,visits:visits||0})}catch(e:any){setError(e.message)}})()},[])
 if(!profile&&!error)return <main className="container"><Loading text="Loading admin dashboard…"/></main>
 return <main className="container"><div className="page-header"><div><div className="muted small">CRL ADMIN</div><h1 className="page-title">Admin Dashboard</h1></div></div>{error&&<div className="card error-card">{error}</div>}{profile&&<><section className="card profile-card"><div className="avatar">{profile.agent_name.slice(0,2).toUpperCase()}</div><div><div className="profile-name">{profile.agent_name}</div><div className="muted small">{profile.email}</div></div></section><section className="section"><div className="grid grid-4"><div className="card kpi-card"><div className="kpi-label">Customers</div><div className="kpi">{counts.total}</div></div><div className="card kpi-card"><div className="kpi-label">Assigned</div><div className="kpi">{counts.assigned}</div></div><div className="card kpi-card"><div className="kpi-label">Unassigned</div><div className="kpi">{counts.unassigned}</div></div><div className="card kpi-card"><div className="kpi-label">Visits</div><div className="kpi">{counts.visits}</div></div></div></section><section className="section card"><h2 className="section-title">Operations</h2><div className="actions"><Link className="btn" href="/admin/customers">Assign Customers</Link><Link className="btn secondary" href="/admin/visits">Monitor Visits</Link></div></section></>}</main>
}
