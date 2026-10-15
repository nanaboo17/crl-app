'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import dynamic from 'next/dynamic'
import type { HistoryPoint } from '@/components/superadmin/AgentMovementMap'

const AgentMovementMap = dynamic(() => import('@/components/superadmin/AgentMovementMap'), { ssr: false })

type Agent = { email: string; agent_name: string | null; region: string | null; lead_email: string | null }
type Point = { agent_user_id: string; latitude: number; longitude: number; accuracy_meters: number | null; captured_at: string; received_at: string }
type AuthUser = { id: string; email: string | null }
type Diagnostic = { agent_user_id: string; stage: string; error_code: string; error_message: string | null; occurred_at: string }
type DisplayAgent = Agent & { point?: Point; tracking: boolean; onDuty: boolean; diagnostic?: Diagnostic }

export default function AgentLocationsPage() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => locale === 'id' ? id : en
  const [supabase] = useState(() => createClient())
  const [agents, setAgents] = useState<DisplayAgent[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [directory, setDirectory] = useState<AuthUser[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [historyError, setHistoryError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [day, setDay] = useState(() => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()))
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let stopped = false
    async function refresh() {
      const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const [agentResult, locationResult, sessionResult, attendanceResult, diagnosticsResult] = await Promise.all([
        supabase.from('agents').select('email,agent_name,region,lead_email').eq('role', 'agent').eq('active', true),
        supabase.from('agent_location_history').select('agent_user_id,latitude,longitude,accuracy_meters,captured_at,received_at').order('captured_at', { ascending: false }).limit(10000),
        supabase.from('agent_tracking_sessions').select('agent_user_id,status').eq('status', 'active'),
        supabase.from('agent_attendance').select('agent_email,check_in_at,check_out_at').eq('attendance_date', todayWib),
        supabase.from('agent_gps_diagnostics').select('agent_user_id,stage,error_code,error_message,occurred_at').order('occurred_at', { ascending: false }).limit(1000),
      ])
      if (stopped) return
      if (agentResult.error || locationResult.error || sessionResult.error || attendanceResult.error || diagnosticsResult.error) {
        setError(agentResult.error?.message || locationResult.error?.message || sessionResult.error?.message || attendanceResult.error?.message || diagnosticsResult.error?.message || 'Unable to load GPS data.')
        setLoading(false)
        return
      }
      // Auth user IDs are resolved through a restricted, server-side lookup in the RPC.
      const { data: users, error: userError } = await supabase.rpc('crl_agent_location_directory')
      if (stopped) return
      if (userError) { setError(userError.message); setLoading(false); return }
      setDirectory((users as AuthUser[]) ?? [])
      const idByEmail = new Map((users as AuthUser[] ?? []).map((u) => [(u.email ?? '').toLowerCase(), u.id]))
      const latest = new Map<string, Point>()
      for (const p of locationResult.data ?? []) if (!latest.has(p.agent_user_id)) latest.set(p.agent_user_id, p)
      const active = new Set((sessionResult.data ?? []).map((s) => s.agent_user_id))
      const failures = new Map<string, Diagnostic>()
      for (const d of (diagnosticsResult.data ?? [])) if (!failures.has(d.agent_user_id)) failures.set(d.agent_user_id, d)
      const onDuty = new Set((attendanceResult.data ?? []).filter(a => Boolean(a.check_in_at) && !a.check_out_at).map(a => a.agent_email?.trim().toLowerCase()))
      setAgents((agentResult.data ?? []).map((agent) => {
        const id = idByEmail.get(agent.email.toLowerCase())
        return { ...agent, point: id ? latest.get(id) : undefined, tracking: id ? active.has(id) : false, onDuty: onDuty.has(agent.email.trim().toLowerCase()), diagnostic: id ? failures.get(id) : undefined }
      }))
      setError('')
      setLoading(false)
      setNow(Date.now())
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 5 * 60 * 1000)
    return () => { stopped = true; window.clearInterval(interval) }
  }, [supabase])

  const filtered = useMemo(() => agents.filter((a) => {
    const q = search.toLowerCase().trim()
    return (selectedRegions.length === 0 || (a.region != null && selectedRegions.includes(a.region))) &&
      (!q || [a.agent_name, a.email, a.region, a.lead_email].some((x) => x?.toLowerCase().includes(q)))
  }), [agents, search, selectedRegions])
  const selectedUserId = directory.find((u) => u.email?.toLowerCase() === selectedAgent?.toLowerCase())?.id
  useEffect(() => {
    if (!selectedUserId) { setHistory([]); return }
    let cancelled = false
    async function loadHistory() {
      setHistoryLoading(true)
      setHistoryError('')
      // Local WIB day boundaries, converted to timestamptz by PostgREST.
      const start = day + 'T00:00:00+07:00'
      const end = new Date(new Date(start).getTime() + 86400000).toISOString()
      const { data, error } = await supabase.from('agent_location_history')
        .select('latitude,longitude,accuracy_meters,captured_at')
        .eq('agent_user_id', selectedUserId)
        .gte('captured_at', start).lt('captured_at', end)
        .order('captured_at', { ascending: true }).limit(1000)
      if (cancelled) return
      if (error) { setHistoryError(error.message); setHistory([]) }
      else setHistory((data ?? []).filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)))
      setHistoryLoading(false)
    }
    void loadHistory()
    const timer = window.setInterval(() => void loadHistory(), 5 * 60 * 1000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [selectedUserId, day, supabase])
  const regions = Array.from(new Set(agents.map((a) => a.region).filter((x): x is string => Boolean(x)))).sort()
  const age = (p: Point) => Math.max(0, Math.floor((now - Date.parse(p.captured_at)) / 60000))
  const fresh = filtered.filter((a) => a.point && age(a.point) <= 40).length
  const stale = filtered.filter((a) => a.point && age(a.point) > 60).length

  return <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
    <div><h1 className="text-2xl font-bold">{tx('Agent GPS Locations', 'Lokasi GPS Agen')}</h1>
      <p className="text-sm text-base-content/60">{tx('Last reported positions during agent-approved fieldwork. Not live continuous tracking.', 'Lokasi terakhir yang dikirim selama kerja lapangan dengan persetujuan agen. Bukan pelacakan langsung terus-menerus.')}</p></div>
    {error && <p role="alert" className="dui-alert dui-alert-error">{error}</p>}
    <div className="grid grid-cols-3 gap-2">{[
      [tx('Agents', 'Agen'), filtered.length], [tx('Fresh ≤40m', 'Baru ≤40m'), fresh], [tx('Stale >60m', 'Lama >60m'), stale],
    ].map(([label, value]) => <div key={label} className="rounded-xl border border-base-300 bg-base-100 p-3"><div className="text-xs opacity-60">{label}</div><div className="text-2xl font-bold">{value}</div></div>)}</div>
    <div className="flex flex-wrap gap-2">
      <input className="dui-input flex-1" type="search" aria-label={tx('Search agents', 'Cari agen')} placeholder={tx('Search agent, email or lead', 'Cari agen, email atau lead')} value={search} onChange={(e) => setSearch(e.target.value)} />
      <details className="dropdown dropdown-end">
        <summary className="dui-btn dui-btn-outline">{tx('Regions', 'Region')} {selectedRegions.length ? '(' + selectedRegions.length + ')' : tx('— All', '— Semua')}</summary>
        <div className="dropdown-content z-30 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-3 shadow-xl">
          <button type="button" className="dui-btn dui-btn-ghost dui-btn-xs mb-2" onClick={() => setSelectedRegions([])}>{tx('Clear / All regions', 'Hapus / Semua region')}</button>
          {regions.map(r => <label key={r} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-base-200">
            <input type="checkbox" className="dui-checkbox dui-checkbox-sm" checked={selectedRegions.includes(r)}
              onChange={e => setSelectedRegions(current => e.target.checked ? [...current,r] : current.filter(item => item !== r))} />
            <span>{r}</span>
          </label>)}
        </div>
      </details>
    </div>
    {selectedAgent && <section className="overflow-hidden rounded-xl border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><h2 className="font-bold">{selectedAgent}</h2><p className="text-xs text-base-content/60">{tx('Recorded GPS movement by timestamp (WIB)', 'Pergerakan GPS berdasarkan waktu (WIB)')}</p></div>
        <div className="flex items-center gap-2">
          <input type="date" className="dui-input dui-input-sm" aria-label={tx('Movement date', 'Tanggal pergerakan')} value={day} onChange={e=>setDay(e.target.value)} />
          <button className="dui-btn dui-btn-ghost dui-btn-sm" type="button" onClick={()=>setSelectedAgent(null)}>{tx('Close', 'Tutup')}</button>
        </div>
      </div>
      {historyError && <p role="alert" className="p-3 text-error">{historyError}</p>}
      {historyLoading ? <p className="p-6">{tx('Loading GPS points...', 'Memuat titik GPS...')}</p>
        : history.length ? <>
            <AgentMovementMap points={history} locale={locale}/>
            <div className="flex flex-wrap items-center gap-4 p-3 text-xs"><span>🔵 {tx('First', 'Awal')}</span><span>🟣 {tx('Intermediate', 'Pertengahan')}</span><span>🔴 {tx('Latest', 'Terakhir')}</span><span>🟠 {tx('Low accuracy (excluded from trusted line)', 'Akurasi rendah (tidak masuk jalur tepercaya)')}</span><strong>{history.length} {tx('recorded points', 'titik terekam')}</strong></div>
            <div className="max-h-48 overflow-auto border-t border-base-300">
              <table className="dui-table dui-table-xs"><thead><tr><th>#</th><th>{tx('Time (WIB)', 'Waktu (WIB)')}</th><th>Latitude</th><th>Longitude</th><th>{tx('Accuracy', 'Akurasi')}</th></tr></thead>
              <tbody>{history.map((p,i)=><tr key={p.captured_at+'-'+i}><td>{i+1}</td><td>{new Date(p.captured_at).toLocaleString(locale==='id'?'id-ID':'en-GB',{timeZone:'Asia/Jakarta',hour12:false})}</td><td>{p.latitude.toFixed(6)}</td><td>{p.longitude.toFixed(6)}</td><td>{p.accuracy_meters==null?'—':Math.round(p.accuracy_meters)+' m'}{(p.accuracy_meters==null || p.accuracy_meters>100) && <span className="ml-1 text-warning">⚠</span>}</td></tr>)}</tbody></table>
            </div>
          </> : <p className="p-6 text-sm text-base-content/60">{tx('No recorded GPS points for this date.', 'Tidak ada titik GPS terekam pada tanggal ini.')}</p>}
      <p className="p-3 text-xs text-base-content/60">{tx('Line segments connect recorded GPS points, not actual roads. Missing updates do not imply movement.', 'Garis menghubungkan titik GPS yang tercatat, bukan jalan yang benar-benar dilalui. Pembaruan yang hilang tidak menunjukkan pergerakan.')}</p>
    </section>}
    {loading ? <p>{tx('Loading...', 'Memuat...')}</p> : <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
      <table className="dui-table"><thead><tr><th>{tx('Agent', 'Agen')}</th><th>Region</th><th>{tx('Attendance', 'Absensi')}</th><th>{tx('GPS session', 'Sesi GPS')}</th><th>{tx('GPS health', 'Kondisi GPS')}</th><th>{tx('Last GPS', 'GPS terakhir')}</th><th>{tx('Accuracy', 'Akurasi')}</th><th>{tx('Location', 'Lokasi')}</th></tr></thead>
      <tbody>{filtered.map((a) => { const p = a.point; const mins = p ? age(p) : null; return <tr key={a.email}>
        <td><strong>{a.agent_name || a.email}</strong><div className="text-xs opacity-60">{a.email}</div></td>
        <td>{a.region || '—'}</td>
        <td><span className={`dui-badge dui-badge-sm ${a.onDuty ? 'dui-badge-success' : 'dui-badge-ghost'}`}>{a.onDuty ? tx('On duty', 'Bertugas') : tx('Off duty', 'Tidak bertugas')}</span></td>
        <td><span className={`dui-badge dui-badge-sm ${a.tracking ? 'dui-badge-info' : 'dui-badge-ghost'}`}>{a.tracking ? tx('Active', 'Aktif') : tx('Not active', 'Tidak aktif')}</span></td>
        <td>{(() => {
          const since = p ? age(p) : null
          const failed = a.diagnostic && (!p || Date.parse(a.diagnostic.occurred_at) > Date.parse(p.captured_at))
          const state = !a.onDuty ? tx('Off duty', 'Tidak bertugas')
            : !a.tracking ? tx('No GPS session', 'Tidak ada sesi GPS')
            : !p ? tx('GPS missing', 'GPS belum ada')
            : p.accuracy_meters == null || p.accuracy_meters > 100 ? tx('Low accuracy', 'Akurasi rendah')
            : since !== null && since > 40 ? tx('GPS stale', 'GPS terlambat')
            : tx('GPS healthy', 'GPS normal')
          const tone = !a.onDuty ? 'dui-badge-ghost' : (state === tx('GPS healthy', 'GPS normal') ? 'dui-badge-success' : 'dui-badge-warning')
          const detail = failed ? [a.diagnostic?.stage, a.diagnostic?.error_code, a.diagnostic?.error_message].filter(Boolean).join(' · ') : ''
          return <><span className={`dui-badge dui-badge-sm ${tone}`}>{state}</span>{detail && <div className="mt-1 max-w-64 break-words text-xs text-error" title={detail}>{detail}</div>}</>
        })()}</td>
        <td>{p ? <><div>{new Date(p.captured_at).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB')}</div><span className={`dui-badge dui-badge-sm ${mins! > 60 ? 'dui-badge-error' : mins! > 40 ? 'dui-badge-warning' : 'dui-badge-success'}`}>{mins}m {tx('ago', 'lalu')}</span></> : '—'}</td>
        <td>{p?.accuracy_meters != null ? Math.round(p.accuracy_meters) + ' m' : '—'}</td>
        <td>{p ? <><a className="dui-link dui-link-primary" href={`https://www.google.com/maps?q=${encodeURIComponent(p.latitude + ',' + p.longitude)}`} target="_blank" rel="noopener noreferrer">{tx('External map', 'Peta eksternal')}</a> <button type="button" className="dui-btn dui-btn-ghost dui-btn-xs" onClick={() => { setSelectedAgent(a.email); setHistory([]); setHistoryLoading(true) }}>{tx('Show here', 'Tampilkan')}</button></> : '—'}</td>
      </tr> })}</tbody></table>
    </div>}
    <p className="text-xs text-base-content/50">{tx('GPS can pause when browsers are closed or phones are locked. Old coordinates are not proof of current position. Updated every five minutes while this page is open.', 'GPS dapat berhenti ketika browser ditutup atau ponsel dikunci. Koordinat lama bukan bukti posisi saat ini. Diperbarui setiap lima menit selama halaman ini terbuka.')}</p>
  </main>
}
