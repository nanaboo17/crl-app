'use client'
import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, FileText, ClipboardList, Clock3, CheckCircle2, XCircle, UploadCloud } from 'lucide-react'
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
 const counts={pending:rows.filter(r=>r.status==='pending').length,approved:rows.filter(r=>r.status==='approved').length,rejected:rows.filter(r=>r.status==='rejected').length}
 const statusStyle:Record<string,string>={pending:'bg-amber-100 text-amber-800',approved:'bg-emerald-100 text-emerald-800',rejected:'bg-rose-100 text-rose-800',cancelled:'bg-base-200 text-base-content/70'}
 const statusLabel:Record<string,string>={pending:'Menunggu',approved:'Disetujui',rejected:'Ditolak',cancelled:'Dibatalkan'}
 return <main className="mx-auto w-full max-w-5xl space-y-6 p-4 pb-12 sm:p-6 lg:p-8">
  <header className="space-y-3">
   <Link href="/agent/attendance" className="inline-flex text-sm font-medium text-primary hover:underline">← Kembali ke Kehadiran</Link>
   <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Attendance Management</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Pengajuan Sakit & Izin</h1><p className="mt-1 text-sm text-base-content/60">Ajukan ketidakhadiran dan pantau status persetujuan dari Lead.</p></div>
  </header>
  <section className="grid grid-cols-3 gap-2 sm:gap-3">
   {[{label:'Menunggu',value:counts.pending,icon:Clock3,color:'text-amber-600'},{label:'Disetujui',value:counts.approved,icon:CheckCircle2,color:'text-emerald-600'},{label:'Ditolak',value:counts.rejected,icon:XCircle,color:'text-rose-600'}].map(({label,value,icon:Icon,color})=><div key={label} className="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm sm:p-4"><Icon className={color} size={20}/><p className="mt-2 text-2xl font-bold">{value}</p><p className="text-xs text-base-content/60 sm:text-sm">{label}</p></div>)}
  </section>
  <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
   <div className="border-b border-base-300 p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><ClipboardList size={20} className="text-primary"/>Form Pengajuan</h2><p className="mt-1 text-sm text-base-content/60">Lengkapi data di bawah. Permintaan akan dikirim ke Lead yang ditugaskan.</p></div>
   <form onSubmit={submit} className="space-y-5 p-4 sm:p-5">
    <fieldset className="space-y-2"><legend className="text-sm font-semibold">Jenis pengajuan</legend><div className="grid grid-cols-2 gap-3">{[{value:'sick',label:'Sakit',hint:'Bukti wajib diunggah'},{value:'permission',label:'Izin',hint:'Bukti tidak wajib'}].map(option=><label key={option.value} className={`cursor-pointer rounded-xl border p-3 transition-colors ${type===option.value?'border-primary bg-primary/5':'border-base-300 hover:border-primary/50'}`}><input type="radio" name="request-type" value={option.value} checked={type===option.value} onChange={()=>setType(option.value)} className="dui-radio dui-radio-primary dui-radio-sm mr-2 align-middle"/><span className="font-semibold">{option.label}</span><p className="mt-1 text-xs text-base-content/60">{option.hint}</p></label>)}</div></fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
     <label className="block space-y-1.5"><span className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16}/>Tanggal mulai</span><input required type="date" value={start} onChange={e=>setStart(e.target.value)} className="dui-input dui-input-bordered w-full"/></label>
     <label className="block space-y-1.5"><span className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16}/>Tanggal selesai</span><input required type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)} className="dui-input dui-input-bordered w-full"/></label>
    </div>
    <label className="block space-y-1.5"><span className="text-sm font-semibold">Alasan pengajuan</span><textarea required minLength={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} className="dui-textarea dui-textarea-bordered min-h-28 w-full" placeholder="Jelaskan alasan secara singkat…" rows={4}/><span className="block text-right text-xs text-base-content/50">{reason.length}/1000 karakter</span></label>
    <label className="block space-y-2"><span className="flex items-center gap-2 text-sm font-semibold"><UploadCloud size={17}/>Bukti pendukung <span className={`rounded-full px-2 py-0.5 text-xs ${type==='sick'?'bg-amber-100 text-amber-800':'bg-base-200 text-base-content/65'}`}>{type==='sick'?'Wajib':'Opsional'}</span></span><div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 p-4"><input type="file" required={type==='sick'} accept=".jpg,.jpeg,.png,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)} className="dui-file-input dui-file-input-bordered w-full"/><p className="mt-2 text-xs text-base-content/60">{file?`Dipilih: ${file.name}`:'JPG, PNG, atau PDF · maksimal 5 MB · disimpan privat'}</p></div></label>
    {error&&<p role="alert" className="rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}{success&&<p role="status" className="rounded-xl bg-success/10 p-3 text-sm text-success">{success}</p>}
    <button disabled={busy||!email} className="dui-btn dui-btn-primary w-full sm:w-auto">{busy?'Mengirim…':'Kirim Pengajuan'}</button>
   </form>
  </section>
  <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
   <div className="flex items-center justify-between border-b border-base-300 p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><FileText size={20} className="text-primary"/>Riwayat Pengajuan</h2><span className="text-sm text-base-content/60">{rows.length} pengajuan</span></div>
   {rows.length===0?<p className="p-6 text-center text-sm text-base-content/60">Belum ada pengajuan.</p>:<div className="divide-y divide-base-300">{rows.map(r=><article key={r.id} className="space-y-3 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{r.request_type==='sick'?'Sakit':'Izin'}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-base-content/65"><CalendarDays size={15}/>{r.start_date} – {r.end_date}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[r.status]||statusStyle.cancelled}`}>{statusLabel[r.status]||r.status}</span></div>
    <div className="rounded-lg bg-base-200/50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Alasan</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.reason}</p></div>
    {r.rejection_reason&&<p className="rounded-lg bg-error/10 p-3 text-sm text-error">Alasan penolakan: {r.rejection_reason}</p>}
    {r.status==='pending'&&<button type="button" onClick={()=>void cancel(r.id)} className="dui-btn dui-btn-outline dui-btn-sm">Batalkan pengajuan</button>}
   </article>)}</div>}
  </section>
 </main>
}
