'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CalendarClock, ClipboardList, Loader2, RefreshCw, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import chrome from './SuperadminChrome.module.css'

type Summary = { unassigned: number; missing_checkout: number; visits_today: number; date: string }
const empty: Summary = { unassigned: 0, missing_checkout: 0, visits_today: 0, date: '' }
export default function SuperadminNotifications({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<Summary>(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const id = locale === 'id'
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await createClient().rpc('crl_superadmin_notifications_v1')
      if (error) throw error
      setSummary({ unassigned: Number(data?.unassigned || 0), missing_checkout: Number(data?.missing_checkout || 0), visits_today: Number(data?.visits_today || 0), date: String(data?.date || '') })
    } catch (err) {
      setError(err instanceof Error ? err.message : id ? 'Gagal memuat notifikasi' : 'Could not load notifications')
    } finally { setLoading(false) }
  }, [id])
  useEffect(() => { if (open) void load() }, [open, load])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const alerts = [
    { count: summary.unassigned, title: id ? 'Pelanggan belum ditugaskan' : 'Unassigned customers', note: id ? 'Pelanggan actionable belum memiliki agen' : 'Actionable customers without an agent', href: '/superadmin/customers', Icon: Users },
    { count: summary.missing_checkout, title: id ? 'Belum checkout kemarin' : 'Missing checkout yesterday', note: id ? 'Agen hadir tanpa checkout' : 'Agents checked in without checking out', href: '/superadmin/attendance', Icon: CalendarClock },
  ]
  const alertCount = alerts.reduce((total, item) => total + item.count, 0)
  return <div ref={root} className="relative">
    <button type="button" className={`${chrome.iconButton} relative`} aria-label={id ? 'Notifikasi' : 'Notifications'} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(v => !v)} title={id ? 'Notifikasi' : 'Notifications'}>
      <Bell aria-hidden="true" className="h-5 w-5" />
      {alertCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-pink-600 px-1 text-[9px] font-black text-white">{alertCount > 99 ? '99+' : alertCount}</span>}
    </button>
    {open && <div role="dialog" aria-label={id ? 'Pusat notifikasi' : 'Notification center'} className="fixed left-3 right-3 top-[78px] z-[999] max-h-[min(75dvh,540px)] overflow-y-auto rounded-2xl border border-purple-200 bg-white p-4 text-slate-900 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[360px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div><h2 className="text-base font-black">{id ? 'Pusat Notifikasi' : 'Notification Center'}</h2><p className="text-xs text-slate-500">{id ? 'Ringkasan operasional terbaru' : 'Latest operational overview'}</p></div>
        <div className="flex items-center gap-1"><button type="button" className="rounded-lg p-2 text-purple-700 hover:bg-purple-50" aria-label={id ? 'Muat ulang' : 'Refresh'} onClick={() => void load()} disabled={loading}><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/></button><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={id ? 'Tutup' : 'Close'} onClick={() => setOpen(false)}><X size={17}/></button></div>
      </div>
      {loading && <p role="status" className="flex items-center gap-2 py-5 text-sm text-slate-500"><Loader2 size={17} className="animate-spin"/>{id ? 'Memuat notifikasi…' : 'Loading notifications…'}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      {!loading && !error && <>
        {alerts.filter(item => item.count > 0).map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="mb-2 flex items-start gap-3 rounded-xl border border-purple-100 bg-purple-50/50 p-3 hover:bg-purple-100"><span className="rounded-lg bg-white p-2 text-purple-700"><item.Icon size={18}/></span><span className="min-w-0 flex-1"><strong className="block text-sm">{item.title}</strong><small className="block text-xs text-slate-500">{item.note}</small></span><strong className="text-lg text-purple-700">{item.count.toLocaleString('id-ID')}</strong></Link>)}
        {alertCount === 0 && <p className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{id ? 'Tidak ada peringatan yang membutuhkan tindakan.' : 'No alerts need attention.'}</p>}
        <Link href="/superadmin/visits?mode=agent&filter=all&page=1" onClick={() => setOpen(false)} className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"><ClipboardList size={18} className="text-purple-700"/><span className="flex-1 text-sm font-semibold">{id ? 'Kunjungan hari ini' : 'Visits today'}</span><strong>{summary.visits_today.toLocaleString('id-ID')}</strong></Link>
        <p className="mt-3 text-[11px] text-slate-500">{id ? 'Dihitung saat panel dibuka. Bukan notifikasi push.' : 'Updated when opened. Not push notifications.'}</p>
      </>}
    </div>}
  </div>
}
