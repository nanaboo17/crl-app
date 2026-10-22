'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Clock3, FileText, Search, ShieldCheck, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'

type LeaveRequest = {
  id: string
  agent_email: string
  lead_email: string
  request_type: 'sick' | 'permission'
  start_date: string
  end_date: string
  reason: string
  evidence_path: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  created_at: string
  rejection_reason: string | null
}

const statusLabels: Record<LeaveRequest['status'], string> = {
  pending: 'Menunggu persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
}

const statusStyles: Record<LeaveRequest['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 ring-rose-200',
  cancelled: 'bg-base-200 text-base-content/70 ring-base-300',
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(Date.UTC(year, month - 1, day, 12)))
}

function dateRange(start: string, end: string) {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
}

function duration(start: string, end: string) {
  const days = Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000) + 1
  return `${days} hari kalender`
}

export default function LeaveApprovalsPage() {
  const { locale } = useI18n()
  const tx = (id:string,en:string)=>locale==='id'?id:en
  const [rows, setRows] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  async function reload() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user?.email) {
      window.location.replace('/login')
      return
    }
    const { data, error: requestError } = await sb.from('agent_leave_requests')
      .select('id,agent_email,lead_email,request_type,start_date,end_date,reason,evidence_path,status,created_at,rejection_reason')
      .order('created_at', { ascending: false }).limit(300)
    if (requestError) setError(requestError.message)
    else { setRows((data || []) as LeaveRequest[]); setError('') }
    setLoading(false)
  }

  useEffect(() => { void reload() }, [])

  const counts = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(r => r.status === 'pending').length,
    approved: rows.filter(r => r.status === 'approved').length,
    rejected: rows.filter(r => r.status === 'rejected').length,
  }), [rows])

  const visible = useMemo(() => rows.filter(r =>
    (filter === 'all' || r.status === filter) &&
    (!search.trim() || [r.agent_email, r.lead_email, r.reason].some(v => v.toLowerCase().includes(search.toLowerCase().trim())))
  ), [rows, filter, search])

  async function decide(id: string, decision: 'approved' | 'rejected', reason: string | null = null) {
    setBusy(id)
    setError('')
    try {
      const { error: reviewError } = await createClient().rpc('crl_review_leave_request', {
        p_request_id: id, p_decision: decision, p_reason: reason,
      })
      if (reviewError) throw reviewError
      setRejectId(null)
      setRejectReason('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses pengajuan.')
    } finally {
      setBusy('')
    }
  }

  async function viewEvidence(path: string) {
    const { data, error: fileError } = await createClient().storage.from('leave-evidence').createSignedUrl(path, 60)
    if (fileError || !data?.signedUrl) { setError(fileError?.message || 'Bukti tidak tersedia.'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-10 sm:p-6 lg:p-8">
      <div className="space-y-3">
        <Link href="/superadmin/attendance" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">← Kembali ke Attendance</Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-base-content/60"><ShieldCheck size={16}/> Attendance Management</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tx('Persetujuan Sakit & Izin','Sick & Permission Approvals')}</h1>
            <p className="max-w-2xl text-sm text-base-content/65">{tx('Tinjau pengajuan, lihat dokumen pendukung secara privat, dan kelola persetujuan agent sesuai kewenangan.','Review requests, view private supporting documents, and manage approvals within your permissions.')}</p>
          </div>
          <button onClick={() => void reload()} className="dui-btn dui-btn-outline dui-btn-sm">{tx('Refresh data','Refresh data')}</button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan pengajuan">
        {[
          { label: 'Total Pengajuan', value: counts.total, icon: CalendarDays, color: 'text-primary' },
          { label: 'Menunggu', value: counts.pending, icon: Clock3, color: 'text-amber-600' },
          { label: 'Disetujui', value: counts.approved, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Ditolak', value: counts.rejected, icon: XCircle, color: 'text-rose-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs font-medium text-base-content/65 sm:text-sm">{label}</span><Icon size={19} className={color}/></div>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">Daftar Pengajuan <span className="text-sm font-normal text-base-content/55">({visible.length})</span></h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="dui-input dui-input-bordered flex items-center gap-2">
              <Search size={16} className="shrink-0 opacity-50"/>
              <input className="min-w-0 grow" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari agent atau alasan…" aria-label="Cari pengajuan"/>
            </label>
            <select className="dui-select dui-select-bordered" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter status">
              <option value="all">{tx('Semua status','All statuses')}</option>
              <option value="pending">{tx('Menunggu','Pending')}</option>
              <option value="approved">{tx('Disetujui','Approved')}</option>
              <option value="rejected">{tx('Ditolak','Rejected')}</option>
              <option value="cancelled">{tx('Dibatalkan','Cancelled')}</option>
            </select>
          </div>
        </div>

        {error && <p className="m-4 rounded-xl bg-error/10 p-3 text-sm text-error" role="alert">{error}</p>}
        {loading ? <div className="p-10 text-center text-sm text-base-content/60">Memuat pengajuan…</div> :
          visible.length === 0 ? <div className="p-10 text-center text-sm text-base-content/60">Tidak ada pengajuan yang cocok.</div> :
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-base-200 text-left text-xs uppercase tracking-wide text-base-content/70">
                <tr>
                  <th className="p-3">Agent</th>
                  <th className="p-3">{tx('Jenis','Type')}</th>
                  <th className="p-3">{tx('Periode','Period')}</th>
                  <th className="p-3">{tx('Alasan','Reason')}</th>
                  <th className="p-3">{tx('Status','Status')}</th>
                  <th className="p-3">{tx('Bukti','Evidence')}</th>
                  <th className="p-3">{tx('Tindakan','Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {visible.map(r => (
                  <tr key={r.id} className="align-top hover:bg-base-200/30">
                    <td className="max-w-56 break-all p-3">
                      <p className="font-semibold">{r.agent_email}</p>
                      <p className="mt-1 text-xs text-base-content/50">Lead: {r.lead_email}</p>
                    </td>
                    <td className="p-3"><span className="font-medium">{r.request_type==='sick'?tx('Sakit','Sick'):tx('Izin','Permission')}</span></td>
                    <td className="whitespace-nowrap p-3">{dateRange(r.start_date,r.end_date)}<p className="mt-1 text-xs text-base-content/55">{duration(r.start_date,r.end_date)}</p></td>
                    <td className="max-w-60 whitespace-pre-wrap break-words p-3">{r.reason}{r.rejection_reason&&<p className="mt-2 text-xs text-error">{tx('Ditolak','Rejected')}: {r.rejection_reason}</p>}</td>
                    <td className="p-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[r.status]}`}>{tx(statusLabels[r.status],{pending:'Pending',approved:'Approved',rejected:'Rejected',cancelled:'Cancelled'}[r.status])}</span></td>
                    <td className="p-3">{r.evidence_path?<button className="dui-btn dui-btn-outline dui-btn-xs" onClick={()=>void viewEvidence(r.evidence_path!)}><FileText size={14}/>{tx('Lihat','View')}</button>:'—'}</td>
                    <td className="p-3">{r.status==='pending'?
                      <div className="flex flex-col gap-2">
                        <button disabled={busy===r.id} className="dui-btn dui-btn-success dui-btn-xs" onClick={()=>void decide(r.id,'approved')}>{tx('Setujui','Approve')}</button>
                        <button disabled={busy===r.id} className="dui-btn dui-btn-outline dui-btn-error dui-btn-xs" onClick={()=>{setRejectId(r.id);setRejectReason('')}}>{tx('Tolak','Reject')}</button>
                      </div>:<span className="text-base-content/40">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </section>

      {rejectId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
        <div className="w-full max-w-md rounded-2xl bg-base-100 p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="reject-title">
          <h2 id="reject-title" className="text-lg font-bold">{tx('Tolak pengajuan','Reject request')}</h2>
          <p className="mt-1 text-sm text-base-content/65">{tx('Berikan alasan penolakan untuk agent.','Provide a rejection reason for the agent.')}</p>
          <textarea className="dui-textarea dui-textarea-bordered mt-4 w-full" rows={3} minLength={5} maxLength={1000} autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Alasan penolakan (minimal 5 karakter)"/>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="dui-btn dui-btn-ghost" onClick={() => setRejectId(null)}>{tx('Batal','Cancel')}</button>
            <button type="button" className="dui-btn dui-btn-error" disabled={rejectReason.trim().length < 5 || busy === rejectId} onClick={() => void decide(rejectId, 'rejected', rejectReason)}>{tx('Tolak pengajuan','Reject request')}</button>
          </div>
        </div>
      </div>}
    </main>
  )
}
