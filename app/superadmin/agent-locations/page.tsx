'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'

type Agent = { email: string; agent_name: string | null; region: string | null; lead_email: string | null }
type Point = { agent_user_id: string; latitude: number; longitude: number; accuracy_meters: number | null; captured_at: string; received_at: string }
type AuthUser = { id: string; email: string | null }
type DisplayAgent = Agent & { point?: Point; tracking: boolean }

export default function AgentLocationsPage() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => locale === 'id' ? id : en
  const supabase = createClient()
  const [agents, setAgents] = useState<DisplayAgent[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('all')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let stopped = false
    async function refresh() {
      const [agentResult, locationResult, sessionResult] = await Promise.all([
        supabase.from('agents').select('email,agent_name,region,lead_email').eq('role', 'agent').eq('active', true),
        supabase.from('agent_location_history').select('agent_user_id,latitude,longitude,accuracy_meters,captured_at,received_at').order('captured_at', { ascending: false }).limit(10000),
        supabase.from('agent_tracking_sessions').select('agent_user_id,status').eq('status', 'active'),
      ])
      if (stopped) return
      if (agentResult.error || locationResult.error || sessionResult.error) {
        setError(agentResult.error?.message || locationResult.error?.message || sessionResult.error?.message || 'Unable to load GPS data.')
        setLoading(false)
        return
      }
      // Auth user IDs are resolved through a restricted, server-side lookup in the RPC.
      const { data: users, error: userError } = await supabase.rpc('crl_agent_location_directory')
      if (stopped) return
      if (userError) { setError(userError.message); setLoading(false); return }
      const idByEmail = new Map((users as AuthUser[] ?? []).map((u) => [(u.email ?? '').toLowerCase(), u.id]))
      const latest = new Map<string, Point>()
      for (const p of locationResult.data ?? []) if (!latest.has(p.agent_user_id)) latest.set(p.agent_user_id, p)
      const active = new Set((sessionResult.data ?? []).map((s) => s.agent_user_id))
      setAgents((agentResult.data ?? []).map((agent) => {
        const id = idByEmail.get(agent.email.toLowerCase())
        return { ...agent, point: id ? latest.get(id) : undefined, tracking: id ? active.has(id) : false }
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
    return (region === 'all' || a.region === region) &&
      (!q || [a.agent_name, a.email, a.region, a.lead_email].some((x) => x?.toLowerCase().includes(q)))
  }), [agents, search, region])
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
      <select className="dui-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region"><option value="all">{tx('All regions', 'Semua region')}</option>{regions.map((r) => <option key={r} value={r}>{r}</option>)}</select>
    </div>
    {loading ? <p>{tx('Loading...', 'Memuat...')}</p> : <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
      <table className="dui-table"><thead><tr><th>{tx('Agent', 'Agen')}</th><th>Region</th><th>{tx('Tracking', 'Pelacakan')}</th><th>{tx('Last GPS', 'GPS terakhir')}</th><th>{tx('Accuracy', 'Akurasi')}</th><th>{tx('Location', 'Lokasi')}</th></tr></thead>
      <tbody>{filtered.map((a) => { const p = a.point; const mins = p ? age(p) : null; return <tr key={a.email}>
        <td><strong>{a.agent_name || a.email}</strong><div className="text-xs opacity-60">{a.email}</div></td>
        <td>{a.region || '—'}</td>
        <td><span className={`dui-badge dui-badge-sm ${a.tracking ? 'dui-badge-success' : 'dui-badge-ghost'}`}>{a.tracking ? tx('On duty', 'Bertugas') : tx('Off duty', 'Tidak bertugas')}</span></td>
        <td>{p ? <><div>{new Date(p.captured_at).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB')}</div><span className={`dui-badge dui-badge-sm ${mins! > 60 ? 'dui-badge-error' : mins! > 40 ? 'dui-badge-warning' : 'dui-badge-success'}`}>{mins}m {tx('ago', 'lalu')}</span></> : '—'}</td>
        <td>{p?.accuracy_meters != null ? Math.round(p.accuracy_meters) + ' m' : '—'}</td>
        <td>{p ? <a className="dui-link dui-link-primary" href={`https://www.google.com/maps?q=${encodeURIComponent(p.latitude + ',' + p.longitude)}`} target="_blank" rel="noopener noreferrer">{tx('Open map', 'Buka peta')}</a> : '—'}</td>
      </tr> })}</tbody></table>
    </div>}
    <p className="text-xs text-base-content/50">{tx('GPS can pause when browsers are closed or phones are locked. Old coordinates are not proof of current position. Updated every five minutes while this page is open.', 'GPS dapat berhenti ketika browser ditutup atau ponsel dikunci. Koordinat lama bukan bukti posisi saat ini. Diperbarui setiap lima menit selama halaman ini terbuka.')}</p>
  </main>
}
