'use client'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getCurrentProfile } from '@/lib/auth'
import type { Customer } from '@/lib/types'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'

export default function NewPreVisitPage(){
 const router=useRouter(); const sp=useSearchParams(); const customerId=sp.get('customer')||''
 const [customer,setCustomer]=useState<Customer|null>(null); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState('')
 const [form,setForm]=useState({contact_confirmed:false,address_confirmed:false,confirmed_address:'',landmark:'',appointment_confirmed:false,appointment_date:'',contact_result:'',supervisor_approval:false,previsit_notes:'',previsit_status:'Pending'})
 useEffect(()=>{(async()=>{const s=createClient(); const {data,error}=await s.from('customers').select('*').eq('customer_id',customerId).single(); if(error)setError(error.message); else setCustomer(data as Customer); setLoading(false)})()},[customerId])
 async function submit(e:FormEvent){e.preventDefault(); setSaving(true); setError(''); try{const p=await getCurrentProfile(); const s=createClient(); const payload={customer_id:customerId,agent_email:p.email,contact_attempt_date:new Date().toISOString(),contact_confirmed:form.contact_confirmed,address_confirmed:form.address_confirmed,confirmed_address:form.address_confirmed?customer?.service_address:form.confirmed_address,landmark:form.landmark||null,appointment_confirmed:form.appointment_confirmed,appointment_date:form.appointment_confirmed&&form.appointment_date?new Date(form.appointment_date).toISOString():null,contact_result:form.contact_result||null,supervisor_approval:form.supervisor_approval,previsit_notes:form.previsit_notes||null,previsit_status:form.previsit_status}; const {data,error}=await s.from('pre_visits').insert(payload).select('previsit_id').single(); if(error) throw error; router.replace(`/agent/pre-visits/${encodeURIComponent(data.previsit_id)}`)}catch(err:any){setError(err.message)}finally{setSaving(false)}}
 if(loading)return <main className="container"><PageTop title="New Pre-Visit" back/><Loading/></main>
 return <main className="container"><PageTop title="New Pre-Visit" back/>
  <form className="card form-card" onSubmit={submit}>
   <div className="form-context"><strong>{customer?.customer_name}</strong><span>{customer?.customer_id}</span><span>{customer?.phone_number||'No phone'}</span></div>
   <label className="checkbox-row"><input type="checkbox" checked={form.contact_confirmed} onChange={e=>setForm({...form,contact_confirmed:e.target.checked})}/><span><strong>Contact confirmed</strong><small>Customer or authorized occupant was reached using the registered business channel.</small></span></label>
   <label className="checkbox-row"><input type="checkbox" checked={form.address_confirmed} onChange={e=>setForm({...form,address_confirmed:e.target.checked})}/><span><strong>Address confirmed</strong><small>Installation address has been verified with the customer.</small></span></label>
   {!form.address_confirmed&&<div className="field"><label>Corrected / confirmed address</label><textarea value={form.confirmed_address} onChange={e=>setForm({...form,confirmed_address:e.target.value})} required/></div>}
   <div className="field"><label>Landmark</label><textarea value={form.landmark} onChange={e=>setForm({...form,landmark:e.target.value})} placeholder="Nearest landmark or access note"/></div>
   <label className="checkbox-row"><input type="checkbox" checked={form.appointment_confirmed} onChange={e=>setForm({...form,appointment_confirmed:e.target.checked})}/><span><strong>Appointment confirmed</strong><small>Customer agreed to the visit schedule.</small></span></label>
   {form.appointment_confirmed&&<div className="field"><label>Appointment date & time</label><input className="input" type="datetime-local" value={form.appointment_date} onChange={e=>setForm({...form,appointment_date:e.target.value})} required/></div>}
   <div className="field"><label>Contact result</label><select value={form.contact_result} onChange={e=>setForm({...form,contact_result:e.target.value})} required><option value="">Select result</option><option>Confirmed</option><option>Unable to Contact</option><option>Customer Unavailable</option><option>Address Mismatch</option><option>Customer Refused Visit</option><option>Unsafe / Access Restricted</option><option>Account Not Recognized</option></select></div>
   <label className="checkbox-row"><input type="checkbox" checked={form.supervisor_approval} onChange={e=>setForm({...form,supervisor_approval:e.target.checked})}/><span><strong>Supervisor exception approved</strong><small>Use only when field visit is approved without normal confirmation.</small></span></label>
   <div className="field"><label>Pre-Visit status</label><select value={form.previsit_status} onChange={e=>setForm({...form,previsit_status:e.target.value})}><option>Pending</option><option>Ready for Visit</option><option>Need Follow-up</option><option>Supervisor Review</option><option>Cancelled</option></select></div>
   <div className="field"><label>Notes</label><textarea value={form.previsit_notes} onChange={e=>setForm({...form,previsit_notes:e.target.value})}/></div>
   {error&&<div className="inline-error">{error}</div>}
   <button className="btn" disabled={saving}>{saving?'Saving…':'Save Pre-Visit'}</button>
  </form>
 </main>
}
