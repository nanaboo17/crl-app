'use client'
import { FormEvent,useEffect,useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { Agent } from '@/lib/types'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'

const blank={email:'',agent_name:'',sales_code:'',role:'agent',active:true}
export default function ManageAgentsPage(){
 const[rows,setRows]=useState<Agent[]>([]);const[form,setForm]=useState<any>(blank);const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);const[error,setError]=useState('')
 async function load(){const s=createClient();const{data,error}=await s.from('agents').select('*').order('agent_name');if(error)setError(error.message);else setRows((data||[])as Agent[]);setLoading(false)}
 useEffect(()=>{load()},[])
 async function add(e:FormEvent){e.preventDefault();setSaving(true);setError('');const s=createClient();const{error}=await s.from('agents').insert({...form,email:form.email.trim().toLowerCase()});if(error)setError(error.message);else{setForm(blank);await load()}setSaving(false)}
 async function toggle(a:Agent){const s=createClient();const{error}=await s.from('agents').update({active:!a.active}).eq('email',a.email);if(error)setError(error.message);else setRows(r=>r.map(x=>x.email===a.email?{...x,active:!x.active}:x))}
 async function changeRole(a:Agent,role:string){const s=createClient();const{error}=await s.from('agents').update({role}).eq('email',a.email);if(error)setError(error.message);else setRows(r=>r.map(x=>x.email===a.email?{...x,role:role as Agent['role']}:x))}
 return <main className="container"><PageTop title="Manage Agents" eyebrow="CRL SUPERADMIN" back/>
 <form className="card form-card" onSubmit={add}><h2 className="section-title">Add agent</h2><div className="field"><label>Name</label><input className="input" value={form.agent_name} onChange={e=>setForm({...form,agent_name:e.target.value})} required/></div><div className="field"><label>Sales code</label><input className="input" value={form.sales_code} onChange={e=>setForm({...form,sales_code:e.target.value})}/></div><div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></div><div className="field"><label>Role</label><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="agent">Agent</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option></select></div>{error&&<div className="inline-error">{error}</div>}<button className="btn" disabled={saving}>{saving?'Adding…':'Add Agent'}</button></form>
 <section className="section">{loading?<Loading/>:<div className="list-stack">{rows.map(a=><div className="card customer-card" key={a.email}><div className="card-row"><div><strong>{a.agent_name}</strong><div className="muted small">{a.email} · {a.sales_code||'No code'}</div></div><span className="status-pill">{a.active?'Active':'Inactive'}</span></div><div className="inline-controls"><select value={a.role} onChange={e=>changeRole(a,e.target.value)}><option value="agent">Agent</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option></select><button className="btn secondary compact" onClick={()=>toggle(a)}>{a.active?'Deactivate':'Activate'}</button></div></div>)}</div>}</section>
 </main>
}
