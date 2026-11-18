'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, ExternalLink, FileText, ImageIcon, X } from 'lucide-react'

export type WeeklyAttendanceDetail = {
  status: 'on_time' | 'late' | 'sick' | 'permission' | 'pending' | 'not_checked_in' | 'unscheduled'
  value: string
  hint: string
  date: string
  agentName: string
  checkInAt?: string | null
  checkOutAt?: string | null
  checkInPhotoUrl?: string | null
  leaveReason?: string | null
  leaveStart?: string | null
  leaveEnd?: string | null
  leaveEvidenceUrl?: string | null
  leaveRequestStatus?: string | null
}

const colors: Record<WeeklyAttendanceDetail['status'], string> = {
  on_time: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  late: 'bg-amber-100 text-amber-900 ring-amber-200',
  sick: 'bg-violet-100 text-violet-900 ring-violet-200',
  permission: 'bg-sky-100 text-sky-900 ring-sky-200',
  pending: 'bg-yellow-100 text-yellow-900 ring-yellow-200',
  not_checked_in: 'bg-rose-100 text-rose-900 ring-rose-200',
  unscheduled: 'bg-base-200 text-base-content/55 ring-base-300',
}

function timeWib(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(date) + ' WIB'
}

function isImageUrl(url: string) {
  // Supabase signed URLs preserve the source object's file extension in the pathname.
  return /\.(?:png|jpg|jpeg|webp|gif)(?:\?|$)/i.test(url)
}

export default function WeeklyAttendanceCell({ detail }: { detail: WeeklyAttendanceDetail }) {
  const [open, setOpen] = useState(false)
  const canOpen = detail.status !== 'unscheduled' && detail.status !== 'not_checked_in'
  const isAttendance = detail.status === 'on_time' || detail.status === 'late'
  const isLeave = detail.status === 'permission' || detail.status === 'sick' || detail.status === 'pending'
  const leaveTitle = detail.status === 'sick' ? 'Detail Sakit' : detail.status === 'permission' ? 'Detail Izin' : 'Detail Pengajuan'

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      {canOpen ? (
        <button
          type="button"
          title={detail.hint + ' · Klik untuk melihat detail'}
          onClick={() => setOpen(true)}
          className={`flex min-h-12 w-full items-center justify-center rounded-lg px-1.5 py-2 font-semibold ring-1 transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${colors[detail.status]}`}
          aria-label={`${detail.agentName} · ${detail.date} · ${detail.hint} · Lihat detail`}
        >
          <span>{detail.value}</span>
          <span aria-hidden="true" className="ml-1 text-[10px] opacity-65">↗</span>
        </button>
      ) : (
        <span title={detail.hint} className={`flex min-h-12 items-center justify-center rounded-lg px-1.5 py-2 font-semibold ring-1 ${colors[detail.status]}`}>{detail.value}</span>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <section role="dialog" aria-modal="true" aria-label={isAttendance ? 'Detail Kehadiran' : leaveTitle} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-base-300 bg-base-100 p-5 text-left text-base-content shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">{isAttendance ? 'Detail Kehadiran' : leaveTitle}</p>
                <h2 className="mt-1 text-lg font-bold">{detail.agentName}</h2>
                <p className="mt-1 text-sm text-base-content/60">{detail.date}</p>
              </div>
              <button type="button" autoFocus onClick={() => setOpen(false)} className="dui-btn dui-btn-ghost dui-btn-sm dui-btn-square" aria-label="Tutup detail"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 border-t border-base-300 pt-4">
              <span className={`inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${colors[detail.status]}`}>{detail.hint}</span>
              {isAttendance && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-base-200/60 p-3"><p className="text-xs text-base-content/60">Check In</p><p className="mt-1 font-semibold">{timeWib(detail.checkInAt)}</p></div>
                    <div className="rounded-xl bg-base-200/60 p-3"><p className="text-xs text-base-content/60">Check Out</p><p className="mt-1 font-semibold">{timeWib(detail.checkOutAt)}</p></div>
                  </div>
                  <h3 className="text-sm font-bold">Foto Check-in</h3>
                  {detail.checkInPhotoUrl ? (
                    <a href={detail.checkInPhotoUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-base-300">
                      <img src={detail.checkInPhotoUrl} alt={`Foto check-in ${detail.agentName} tanggal ${detail.date}`} className="max-h-[360px] w-full bg-base-200 object-contain" />
                      <span className="flex items-center justify-center gap-2 p-3 text-sm font-semibold text-primary"><ExternalLink className="h-4 w-4" /> Buka foto ukuran penuh</span>
                    </a>
                  ) : (
                    <p className="flex items-center gap-2 rounded-xl bg-base-200/60 p-4 text-sm text-base-content/60"><ImageIcon className="h-4 w-4" /> Foto check-in tidak tersedia.</p>
                  )}
                </div>
              )}
              {isLeave && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-2 rounded-xl bg-base-200/60 p-3 text-sm"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs text-base-content/60">Periode Pengajuan</p><strong>{detail.leaveStart || detail.date}{detail.leaveEnd && detail.leaveEnd !== detail.leaveStart ? ` s/d ${detail.leaveEnd}` : ''}</strong></div></div>
                  <div><h3 className="text-sm font-semibold">Alasan / Keterangan</h3><p className="mt-1 whitespace-pre-wrap break-words rounded-xl bg-base-200/60 p-3 text-sm">{detail.leaveReason || 'Tidak ada keterangan.'}</p></div>
                  <div>
                    <h3 className="text-sm font-semibold">Dokumen Pendukung</h3>
                    {detail.leaveEvidenceUrl ? (
                      <div className="mt-2">
                        {isImageUrl(detail.leaveEvidenceUrl) ? <img src={detail.leaveEvidenceUrl} alt={`Bukti pengajuan ${detail.agentName}`} className="max-h-[300px] w-full rounded-xl border border-base-300 bg-base-200 object-contain" /> : null}
                        <a className="dui-btn dui-btn-outline dui-btn-sm mt-2 gap-2" href={detail.leaveEvidenceUrl} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4" /> Lihat bukti <ExternalLink className="h-3.5 w-3.5" /></a>
                      </div>
                    ) : <p className="mt-1 text-sm text-base-content/60">Tidak ada dokumen yang dilampirkan.</p>}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
