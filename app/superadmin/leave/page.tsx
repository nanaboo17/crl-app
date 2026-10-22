'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Clock3, FileText, Search, ShieldCheck, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

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
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Persetujuan Sakit & Izin</h1>
            <p className="max-w-2xl text-sm text-base-content/65">Tinjau pengajuan, lihat dokumen pendukung secara privat, dan kelola persetujuan agent sesuai kewenangan.</p>
          </div>
          <button onClick={() => void reload()} className="dui-btn dui-btn-outline dui-btn-sm">Refresh data</button>
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
              <option value="all">Semua status</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>

        {error && <p className="m-4 rounded-xl bg-error/10 p-3 text-sm text-error" role="alert">{error}</p>}
        {loading ? <div className="p-10 text-center text-sm text-base-content/60">Memuat pengajuan…</div> :
          visible.length === 0 ? <div className="p-10 text-center text-sm text-base-content/60">Tidak ada pengajuan yang cocok.</div> :
          <div className="divide-y divide-base-300">
            {visible.map(r => (
              <article key={r.id} className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-all font-semibold">{r.agent_email}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${r.request_type === 'sick' ? 'bg-blue-50 text-blue-800 ring-blue-200' : 'bg-violet-50 text-violet-800 ring-violet-200'}`}>{r.request_type === 'sick' ? 'Sakit' : 'Izin'}</span>
                    </div>
                    <p className="break-all text-xs text-base-content/55">Lead: {r.lead_email}</p>
                  </div>
                  <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusStyles[r.status]}`}>{statusLabels[r.status]}</span>
                </div>

                <div className="grid gap-3 rounded-xl bg-base-200/60 p-3 text-sm sm:grid-cols-2">
                  <div><p className="text-xs text-base-content/55">Tanggal pengajuan</p><p className="mt-1 flex items-center gap-2 font-medium"><CalendarDays size={15}/>{dateRange(r.start_date, r.end_date)}</p><p className="mt-1 text-xs text-base-content/55">{duration(r.start_date, r.end_date)}</p></div>
                  <div><p className="text-xs text-base-content/55">Diajukan pada</p><p className="mt-1 font-medium">{new Date(r.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })} WIB</p></div>
                </div>

                <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-base-content/55">Alasan</p><p className="whitespace-pre-wrap break-words text-sm">{r.reason}</p></div>
                {r.rejection_reason && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">Alasan penolakan: {r.rejection_reason}</p>}
                <div className="flex flex-wrap items-center gap-2 border-t border-base-200 pt-3">
                  {r.evidence_path && <button type="button" className="dui-btn dui-btn-outline dui-btn-sm gap-2" onClick={() => void viewEvidence(r.evidence_path!)}><FileText size={16}/> Lihat bukti</button>}
                  {r.status === 'pending' && <>
                    <button type="button" disabled={busy === r.id} className="dui-btn dui-btn-success dui-btn-sm" onClick={() => void decide(r.id, 'approved')}>Setujui</button>
                    <button type="button" disabled={busy === r.id} className="dui-btn dui-btn-outline dui-btn-error dui-btn-sm" onClick={() => { setRejectId(r.id); setRejectReason('') }}>Tolak</button>
                  </>}
                </div>
              </article>
            ))}
          </div>
        }
      </section>

      {rejectId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
        <div className="w-full max-w-md rounded-2xl bg-base-100 p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="reject-title">
          <h2 id="reject-title" className="text-lg font-bold">Tolak pengajuan</h2>
          <p className="mt-1 text-sm text-base-content/65">Berikan alasan penolakan untuk agent.</p>
          <textarea className="dui-textarea dui-textarea-bordered mt-4 w-full" rows={3} minLength={5} maxLength={1000} autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Alasan penolakan (minimal 5 karakter)"/>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="dui-btn dui-btn-ghost" onClick={() => setRejectId(null)}>Batal</button>
            <button type="button" className="dui-btn dui-btn-error" disabled={rejectReason.trim().length < 5 || busy === rejectId} onClick={() => void decide(rejectId, 'rejected', rejectReason)}>Tolak pengajuan</button>
          </div>
        </div>
      </div>}
    </main>
  )
}
