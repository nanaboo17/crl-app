'use client'
import { useEffect,useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { Visit, Customer } from '@/lib/types'
import { dateTime } from '@/lib/format'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import StatusPill from '@/components/StatusPill'

export default function VisitDetailPage(){
 const params=useParams<{id:string}>();const id=decodeURIComponent(params.id);const [row,setRow]=useState<Visit|null>(null);const [customer,setCustomer]=useState<Customer|null>(null);const [photoUrl,setPhotoUrl]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('')
 useEffect(()=>{(async()=>{const s=createClient();const {data,error}=await s.from('visits').select('*').eq('visit_id',id).single();if(error){setError(error.message);setLoading(false);return}setRow(data as Visit);const {data:c}=await s.from('customers').select('*').eq('customer_id',data.customer_id).single();setCustomer((c||null) as Customer|null);if(data.visit_photo_url){const {data:signed}=await s.storage.from('visit-evidence').createSignedUrl(data.visit_photo_url,3600);setPhotoUrl(signed?.signedUrl||'')}setLoading(false)})()},[id])
 if(loading)return <main className="container"><PageTop title="Visit" back/><Loading/></main>
 if(error||!row)return <main className="container"><PageTop title="Visit" back/><div className="card error-card">{error||'Not found'}</div></main>
 return <main className="container"><PageTop title="Visit Detail" back/>
  <section className="card"><div className="card-row"><div><strong>{customer?.customer_name||row.customer_id}</strong><div className="muted small">{row.visit_id}</div></div><StatusPill>{row.visit_result||'Submitted'}</StatusPill></div>
   <div className="detail-grid"><div><span>Visit time</span><strong>{dateTime(row.visit_date)}</strong></div><div><span>Consent</span><strong>{row.consent_given?'Yes':'No'}</strong></div><div><span>Latitude</span><strong>{row.latitude?.toFixed(6)||'—'}</strong></div><div><span>Longitude</span><strong>{row.longitude?.toFixed(6)||'—'}</strong></div></div>
   <div className="detail-block"><span>Address</span><p>{row.visit_address||'—'}</p></div><div className="detail-block"><span>Summary</span><p>{row.visit_summary||'—'}</p></div>
   {photoUrl&&<img className="evidence-image" src={photoUrl} alt="Visit evidence"/>}
   {row.latitude!==null&&row.longitude!==null&&<a className="btn secondary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}>Open Location</a>}
  </section>
 </main>
}
