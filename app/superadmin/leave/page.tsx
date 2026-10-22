'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
type R={id:string;agent_email:string;lead_email:string;request_type:string;start_date:string;end_date:string;reason:string;evidence_path:string|null;status:string;created_at:string;rejection_reason:string|null}
export default function LeaveApprovalsPage(){
 const [rows,setRows]=useState<R[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState('')
 async function reload(){const sb=createClient();const {data:{user}}=await sb.auth.getUser();if(!user?.email){window.location.replace('/login');return}const {data,error}=await sb.from('agent_leave_requests').select('*').order('created_at',{ascending:false}).limit(300);if(error)setError(error.message);else setRows((data||[]) as R[])}
 useEffect(()=>{void reload()},[])
 async function decide(id:string,decision:'approved'|'rejected'){
  const reason=decision==='rejected'?window.prompt('Alasan penolakan (min. 5 karakter):'):null
  if(decision==='rejected'&&(!reason||reason.trim().length<5))return
  setBusy(id);setError('')
  const {error}=await createClient().rpc('crl_review_leave_request',{p_request_id:id,p_decision:decision,p_reason:reason})
  if(error)setError(error.message);else await reload();setBusy('')
 }
 async function viewEvidence(path:string){
  const {data,error}=await createClient().storage.from('leave-evidence').createSignedUrl(path,60)
  if(error||!data?.signedUrl){setError(error?.message||'Evidence unavailable');return}
  window.open(data.signedUrl,'_blank','noopener,noreferrer')
 }
 return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
  <Link href="/superadmin/attendance" className="text-sm underline">← Attendance</Link>
  <header><h1 className="text-2xl font-bold">Persetujuan Sakit / Izin</h1><p className="text-sm opacity-70">Lead hanya dapat menyetujui agent yang ditugaskan kepadanya. Superadmin dapat melakukan monitoring seluruh permohonan.</p></header>
  {error&&<p className="text-error" role="alert">{error}</p>}
  {rows.length===0&&<p>Belum ada pengajuan yang dapat diakses.</p>}
  <div className="space-y-3">{rows.map(r=><article key={r.id} className="rounded-xl border border-base-300 bg-base-100 p-4 space-y-2">
   <div className="flex flex-wrap justify-between gap-2"><strong>{r.agent_email}</strong><span className="font-semibold">{r.status.toUpperCase()}</span></div>
   <p className="text-sm">{r.request_type==='sick'?'Sakit':'Izin'} · {r.start_date} – {r.end_date} · Lead: {r.lead_email}</p>
   <p className="text-sm whitespace-pre-wrap">{r.reason}</p>
   {r.evidence_path&&<button className="dui-btn dui-btn-outline dui-btn-sm" onClick={()=>void viewEvidence(r.evidence_path!)}>Lihat bukti (private)</button>}
   {r.rejection_reason&&<p className="text-sm text-error">Ditolak: {r.rejection_reason}</p>}
   {r.status==='pending'&&<div className="flex gap-2"><button disabled={busy===r.id} className="dui-btn dui-btn-success dui-btn-sm" onClick={()=>void decide(r.id,'approved')}>Approve</button><button disabled={busy===r.id} className="dui-btn dui-btn-error dui-btn-sm" onClick={()=>void decide(r.id,'rejected')}>Reject</button></div>}
  </article>)}</div>
 </main>
}
