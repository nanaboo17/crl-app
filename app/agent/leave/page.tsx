'use client'
import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
type RequestRow = {id:string;request_type:string;start_date:string;end_date:string;status:string;reason:string;rejection_reason:string|null}
export default function AgentLeavePage(){
 const [rows,setRows]=useState<RequestRow[]>([])
 const [email,setEmail]=useState('')
 const [type,setType]=useState('sick')
 const [start,setStart]=useState('')
 const [end,setEnd]=useState('')
 const [reason,setReason]=useState('')
 const [file,setFile]=useState<File|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 async function reload(){
  const sb=createClient()
  const {data:{user}}=await sb.auth.getUser()
  if(!user?.email){window.location.replace('/login');return}
  setEmail(user.email.toLowerCase())
  const {data,error}=await sb.from('agent_leave_requests').select('id,request_type,start_date,end_date,status,reason,rejection_reason').order('created_at',{ascending:false}).limit(100)
  if(error)setError(error.message);else setRows((data||[]) as RequestRow[])
 }
 useEffect(()=>{void reload()},[])
 async function submit(e:FormEvent){
  e.preventDefault();setError('');setSuccess('')
  if(!start||!end||end<start){setError('Invalid date range');return}
  if(type==='sick'&&!file){setError('Bukti sakit wajib dilampirkan');return}
  setBusy(true)
  try{
   const sb=createClient();let path:string|null=null
   if(file){
    if(file.size>5*1024*1024)throw Error('Maximum file size 5 MB')
    if(!['image/jpeg','image/png','application/pdf'].includes(file.type))throw Error('Only JPG, PNG, or PDF are accepted')
    path=`${email}/${crypto.randomUUID()}.${file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg'}`
    const {error}=await sb.storage.from('leave-evidence').upload(path,file,{contentType:file.type,upsert:false})
    if(error)throw Error(error.message)
   }
   const {error}=await sb.rpc('crl_submit_leave_request',{p_type:type,p_start_date:start,p_end_date:end,p_reason:reason,p_evidence_path:path})
   if(error){if(path)await sb.storage.from('leave-evidence').remove([path]);throw Error(error.message)}
   setSuccess('Pengajuan berhasil dikirim ke Lead');setReason('');setFile(null);await reload()
  }catch(err){setError(err instanceof Error?err.message:'Request failed')}finally{setBusy(false)}
 }
 async function cancel(id:string){
  if(!window.confirm('Batalkan pengajuan ini?'))return
  const {error}=await createClient().rpc('crl_review_leave_request',{p_request_id:id,p_decision:'cancelled'})
  if(error)setError(error.message);else await reload()
 }
 return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
  <Link href="/agent/attendance" className="text-sm underline">← Attendance</Link>
  <header><h1 className="text-2xl font-bold">Pengajuan Sakit / Izin</h1><p className="text-sm opacity-70">Pengajuan satu atau beberapa hari. Persetujuan oleh Lead.</p></header>
  <form onSubmit={submit} className="space-y-4 rounded-2xl border border-base-300 bg-base-100 p-5">
   <label className="block">Jenis pengajuan<select value={type} onChange={e=>setType(e.target.value)} className="dui-select dui-select-bordered mt-1 w-full"><option value="sick">Sakit</option><option value="permission">Izin</option></select></label>
   <div className="grid grid-cols-2 gap-3"><label>Mulai<input required type="date" value={start} onChange={e=>setStart(e.target.value)} className="dui-input dui-input-bordered w-full"/></label><label>Sampai<input required type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)} className="dui-input dui-input-bordered w-full"/></label></div>
   <label className="block">Alasan<textarea required minLength={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} className="dui-textarea dui-textarea-bordered mt-1 w-full" rows={3}/></label>
   <label className="block">Bukti {type==='sick'?'(wajib)':'(opsional)'}<input type="file" required={type==='sick'} accept=".jpg,.jpeg,.png,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)} className="dui-file-input dui-file-input-bordered mt-1 w-full"/><span className="text-xs opacity-60">JPG, PNG, PDF · maksimal 5 MB</span></label>
   {error&&<p role="alert" className="text-sm text-error">{error}</p>}{success&&<p role="status" className="text-sm text-success">{success}</p>}
   <button disabled={busy||!email} className="dui-btn dui-btn-primary w-full">{busy?'Mengirim…':'Kirim Pengajuan'}</button>
  </form>
  <section className="space-y-3"><h2 className="text-lg font-bold">Riwayat Pengajuan</h2>{rows.length===0&&<p className="text-sm opacity-60">Belum ada pengajuan.</p>}{rows.map(r=><article key={r.id} className="rounded-xl border border-base-300 p-4"><div className="flex justify-between gap-2"><strong>{r.request_type==='sick'?'Sakit':'Izin'} · {r.start_date} – {r.end_date}</strong><span className="text-sm font-semibold">{r.status}</span></div><p className="mt-2 text-sm">{r.reason}</p>{r.rejection_reason&&<p className="mt-2 text-sm text-error">Alasan penolakan: {r.rejection_reason}</p>}{r.status==='pending'&&<button onClick={()=>void cancel(r.id)} className="dui-btn dui-btn-ghost dui-btn-sm mt-2">Batalkan</button>}</article>)}</section>
 </main>
}
