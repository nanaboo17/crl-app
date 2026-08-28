'use client'
import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useRouter,useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getCurrentProfile } from '@/lib/auth'
import type { Customer } from '@/lib/types'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'

export default function NewVisitPage(){
 const router=useRouter(); const sp=useSearchParams(); const customerId=sp.get('customer')||''
 const [customer,setCustomer]=useState<Customer|null>(null); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [gpsLoading,setGpsLoading]=useState(false); const [error,setError]=useState('')
 const [photo,setPhoto]=useState<File|null>(null)
 const [form,setForm]=useState({customer_phone:'',updated_phone:'',visit_address:'',latitude:null as number|null,longitude:null as number|null,gps_accuracy:null as number|null,gps_captured_at:'',consent_given:false,visit_result:'',visit_summary:''})
 useEffect(()=>{(async()=>{const s=createClient(); const {data,error}=await s.from('customers').select('*').eq('customer_id',customerId).single(); if(error)setError(error.message); else {setCustomer(data as Customer);setForm(f=>({...f,customer_phone:data.phone_number||'',visit_address:data.service_address||''}))} setLoading(false)})()},[customerId])
 function captureGPS(){setGpsLoading(true);setError(''); if(!navigator.geolocation){setError('Geolocation is not supported by this device.');setGpsLoading(false);return} navigator.geolocation.getCurrentPosition(pos=>{setForm(f=>({...f,latitude:pos.coords.latitude,longitude:pos.coords.longitude,gps_accuracy:pos.coords.accuracy,gps_captured_at:new Date().toISOString()}));setGpsLoading(false)},err=>{setError(`GPS error: ${err.message}`);setGpsLoading(false)},{enableHighAccuracy:true,timeout:15000,maximumAge:0})}
 function onPhoto(e:ChangeEvent<HTMLInputElement>){setPhoto(e.target.files?.[0]||null)}
 async function submit(e:FormEvent){e.preventDefault(); if(!form.consent_given)return setError('Customer consent must be checked before submitting.'); if(form.latitude===null||form.longitude===null)return setError('Capture GPS before submitting.'); if(!photo)return setError('Visit photo is required.'); setSaving(true);setError(''); try{const p=await getCurrentProfile();const s=createClient(); const safeName=photo.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const path=`${p.email}/${customerId}/${Date.now()}-${safeName}`; const {error:uploadError}=await s.storage.from('visit-evidence').upload(path,photo,{upsert:false,contentType:photo.type}); if(uploadError)throw uploadError; const payload={customer_id:customerId,agent_email:p.email,sales_code:p.sales_code,customer_phone:form.customer_phone||null,updated_phone:form.updated_phone||null,visit_address:form.visit_address||null,latitude:form.latitude,longitude:form.longitude,gps_accuracy:form.gps_accuracy,gps_captured_at:form.gps_captured_at,visit_photo_url:path,consent_given:true,visit_result:form.visit_result,visit_summary:form.visit_summary||null}; const {data,error}=await s.from('visits').insert(payload).select('visit_id').single(); if(error)throw error; router.replace(`/agent/visits/${encodeURIComponent(data.visit_id)}`)}catch(err:any){setError(err.message)}finally{setSaving(false)}}
 if(loading)return <main className="container"><PageTop title="New Visit" back/><Loading/></main>
 return <main className="container"><PageTop title="New Visit" back/>
  <form className="card form-card" onSubmit={submit}>
   <div className="form-context"><strong>{customer?.customer_name}</strong><span>{customer?.customer_id}</span><span>{customer?.product||'No product'}</span></div>
   <div className="field"><label>Customer phone</label><input className="input" value={form.customer_phone} onChange={e=>setForm({...form,customer_phone:e.target.value})}/></div>
   <div className="field"><label>Updated phone <span className="muted">(optional)</span></label><input className="input" value={form.updated_phone} onChange={e=>setForm({...form,updated_phone:e.target.value})}/></div>
   <div className="field"><label>Visit address</label><textarea value={form.visit_address} onChange={e=>setForm({...form,visit_address:e.target.value})} required/></div>
   <div className="gps-card"><div><strong>GPS check-in</strong><p className="muted small">Capture location at the customer premises.</p></div><button type="button" className="btn secondary compact" onClick={captureGPS} disabled={gpsLoading}>{gpsLoading?'Locating…':'Capture GPS'}</button>{form.latitude!==null&&<div className="gps-values"><span>Lat {form.latitude.toFixed(6)}</span><span>Lng {form.longitude!.toFixed(6)}</span><span>± {Math.round(form.gps_accuracy||0)} m</span></div>}</div>
   <div className="field"><label>Visit photo</label><input className="input file-input" type="file" accept="image/*" capture="environment" onChange={onPhoto} required/><div className="muted small">Use the rear camera. Avoid unnecessary identity or private-area photos.</div></div>
   <label className="checkbox-row consent"><input type="checkbox" checked={form.consent_given} onChange={e=>setForm({...form,consent_given:e.target.checked})}/><span><strong>Customer consent obtained</strong><small>Customer/authorized person permits account discussion and required visit evidence.</small></span></label>
   <div className="field"><label>Visit result</label><select value={form.visit_result} onChange={e=>setForm({...form,visit_result:e.target.value})} required><option value="">Select result</option><option>Bersedia Melanjutkan Pembayaran</option><option>Tidak Bersedia Melanjutkan Pembayaran</option><option>Tidak Berhasil Dikunjungi</option></select></div>
   <div className="field"><label>Visit summary</label><textarea value={form.visit_summary} onChange={e=>setForm({...form,visit_summary:e.target.value})} required/></div>
   {error&&<div className="inline-error">{error}</div>}
   <button className="btn" disabled={saving}>{saving?'Uploading & saving…':'Submit Visit'}</button>
  </form>
 </main>
}
