'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Download,
  FileBarChart2,
  Printer,
  RefreshCw,
  MapPin,
  X,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import WeeklyAgentActivity from './WeeklyAgentActivity'
import AgentProductivityReview from './AgentProductivityReview'
import dynamic from 'next/dynamic'
import type { HistoryPoint } from '@/components/superadmin/AgentMovementMap'
const AgentMovementMap = dynamic(() => import('@/components/superadmin/AgentMovementMap'), { ssr: false })

type AgentOption = {
  email: string
  agent_name: string | null
  organization: string | null
}

type WeeklyReportRow = {
  agent_email: string
  agent_name: string | null
  week_start: string
  week_end: string
  pre_visits: number
  visits: number
  visit_conversion: number
}

type ReportRow = {
  agent_email: string
  agent_name: string | null
  assigned_customers: number
  paid_customers: number
  unpaid_customers: number
  p1_customers: number
  p2_customers: number
  p3_customers: number
  p4_customers: number
  p5_customers: number
  pre_visits: number
  ready_for_visit: number
  direct_visit: number
  visits: number
  paid_conversations: number
  promise_to_pay: number
  attendance_days: number
  average_worked_minutes: number
}

type AgentFunnelCount = { agent_email:string; unique_previsits:number; unique_met:number; unique_ptp:number }
type VisitedCustomerCount = { agent_email: string; visited_customers: number }
type PaymentConversion = { agent_email: string; paid_after_visit: number; paid_after_previsit: number }
type AuthDirectoryUser = { id: string; email: string | null }

type ProductivityRow = {
  agent_email: string; agent_name: string | null; assigned_leads: number;
  attendance_days: number; no_activity_attendance_days: number; pre_visit_days: number;
  field_visit_days: number; pre_visit_customer_days: number; total_visits: number;
  visits_per_attendance_day: number | null; visits_per_field_day: number | null;
  target_attainment: number | null; met: number; ptp: number; missing_checkout_days: number;
  long_gap_days: number; first_pre_visit: string | null; first_visit: string | null; review: string;
}
const productivityHeaders = ['CRL Agent','Email','Assigned Leads','Attendance Days','No-Activity Attendance Days','Pre-Visit Days','Field Visit Days','Pre-Visit Customer-Days','Total Visits','Paid After Visit','Paid After Previsit','Visits / Attendance Day','Visits / Field Day','Target Attainment','Met','PTP','Missing Checkout Days','Long Gap Days >3h','First Pre-Visit','First Visit','Review'] as const
function productivityValues(r:ProductivityRow, conversion?:PaymentConversion) {
 return [r.agent_name,r.agent_email,r.assigned_leads,r.attendance_days,r.no_activity_attendance_days,
 r.pre_visit_days,r.field_visit_days,r.pre_visit_customer_days,r.total_visits,
 conversion?.paid_after_visit ?? 0,conversion?.paid_after_previsit ?? 0,r.visits_per_attendance_day,r.visits_per_field_day,r.target_attainment==null?'':r.target_attainment+'%',
 r.met,r.ptp,r.missing_checkout_days,r.long_gap_days,r.first_pre_visit,r.first_visit,r.review]
}

function jakartaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export default function SuperadminReportsPage() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = useMemo(() => createClient(), [])
  const today = useMemo(() => jakartaDate(), [])
  const [startDate, setStartDate] = useState(`${today.slice(0, 7)}-01`)
  const [endDate, setEndDate] = useState(today)
  const [organization, setOrganization] = useState('')
  const [agentEmail, setAgentEmail] = useState('')
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [rows, setRows] = useState<ReportRow[]>([])
  const [productivityRows, setProductivityRows] = useState<ProductivityRow[]>([])
  const [dailyTarget, setDailyTarget] = useState('')
  const [weeklyRows, setWeeklyRows] = useState<WeeklyReportRow[]>([])
  const [visitedCustomerRows, setVisitedCustomerRows] = useState<VisitedCustomerCount[]>([])
  const [agentFunnelRows, setAgentFunnelRows] = useState<AgentFunnelCount[]>([])
  const [conversionRows, setConversionRows] = useState<PaymentConversion[]>([])
  const [locationAgent, setLocationAgent] = useState<ProductivityRow | null>(null)
  const [locationRows, setLocationRows] = useState<HistoryPoint[]>([])
  const [locationDay, setLocationDay] = useState(today)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const [agentResult, reportResult, weeklyResult, conversionResult, productivityResult, visitedResult, funnelResult] = await Promise.all([
      supabase
        .from('agents')
        .select('email,agent_name,organization')
        .eq('role', 'agent')
        .eq('active', true)
        .order('agent_name'),
      supabase.rpc('get_superadmin_report', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_agent_email: agentEmail || null,
      }),
      supabase.rpc('get_superadmin_weekly_report', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_agent_email: agentEmail || null,
      }),
      supabase.rpc('crl_circle_report_payment_conversions_v2', {
        p_start_date: startDate, p_end_date: endDate, p_agent_email: agentEmail || null,
      }),
      supabase.rpc('get_superadmin_agent_productivity', {
        p_start_date: startDate, p_end_date: endDate,
        p_agent_email: agentEmail || null,
        p_daily_visit_target: Number(dailyTarget)>0 ? Number(dailyTarget) : null,
      }),
      supabase.rpc('crl_report_visited_customer_counts', {
        p_start_date: startDate, p_end_date: endDate, p_agent_email: agentEmail || null,
      }),
      supabase.rpc('crl_agent_funnel_counts_v1', {
        p_start_date: startDate, p_end_date: endDate, p_agent_email: agentEmail || null,
      }),
    ])

    // Keep successful report sections visible if one expensive RPC times out.
    setAgents((agentResult.data ?? []) as AgentOption[])
    setRows(reportResult.error ? [] : (reportResult.data ?? []) as ReportRow[])
    setWeeklyRows(weeklyResult.error ? [] : (weeklyResult.data ?? []) as WeeklyReportRow[])
    setConversionRows(conversionResult.error ? [] : (conversionResult.data ?? []) as PaymentConversion[])
    setProductivityRows(productivityResult.error ? [] : (productivityResult.data ?? []) as ProductivityRow[])
    setVisitedCustomerRows(visitedResult.error ? [] : (visitedResult.data ?? []) as VisitedCustomerCount[])
    setAgentFunnelRows(funnelResult.error ? [] : (funnelResult.data ?? []) as AgentFunnelCount[])

    const failed = [
      agentResult.error && tx('Agent directory', 'Direktori agen'),
      reportResult.error && tx('Overview', 'Ringkasan'),
      weeklyResult.error && tx('Weekly activity', 'Aktivitas mingguan'),
      conversionResult.error && tx('Payment conversions', 'Konversi pembayaran'),
      productivityResult.error && tx('Productivity', 'Produktivitas'),
      visitedResult.error && tx('Visited customers', 'Pelanggan dikunjungi'),
      funnelResult.error && tx('Recovery funnel', 'Funnel pemulihan'),
    ].filter(Boolean)
    if (failed.length) {
      console.error('Superadmin report RPC failures', { overview: reportResult.error, weekly: weeklyResult.error, productivity: productivityResult.error, conversions: conversionResult.error, visited: visitedResult.error })
      const details = [reportResult.error && `Overview: ${reportResult.error.message}`, weeklyResult.error && `Weekly: ${weeklyResult.error.message}`, productivityResult.error && `Productivity: ${productivityResult.error.message}`].filter(Boolean)
      setError(
        tx('Some report sections could not load', 'Sebagian laporan gagal dimuat') +
        ': ' + failed.join(', ') +
        '. ' + details.join(' · ')
      )
    }
    setLoading(false)
  }, [agentEmail, endDate, startDate, dailyTarget, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const organizations = useMemo(() => Array.from(new Set(
    agents.map((agent) => (agent.organization || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b)), [agents])

  const filteredAgents = useMemo(() => organization
    ? agents.filter((agent) => (agent.organization || '').trim() === organization)
    : agents, [agents, organization])

  const visibleRows = useMemo(() => {
    if (!organization) return rows
    const allowed = new Set(
      agents
        .filter((agent) => (agent.organization || '').trim() === organization)
        .map((agent) => agent.email.toLowerCase())
    )
    return rows.filter((row) => allowed.has(row.agent_email.toLowerCase()))
  }, [agents, organization, rows])

  const visibleProductivityRows = useMemo(() => {
    if (!organization) return productivityRows
    const allowed = new Set(agents.filter(a => (a.organization || '').trim() === organization).map(a => a.email.toLowerCase()))
    return productivityRows.filter(r => allowed.has(r.agent_email.toLowerCase()))
  }, [agents, organization, productivityRows])

  const visibleWeeklyRows = useMemo(() => {
    if (!organization) return weeklyRows
    const allowed = new Set(
      agents
        .filter((agent) => (agent.organization || '').trim() === organization)
        .map((agent) => agent.email.toLowerCase())
    )
    return weeklyRows.filter((row) => allowed.has(row.agent_email.toLowerCase()))
  }, [agents, organization, weeklyRows])

  const weeklyTotals = useMemo(() => {
    const byWeek = new Map<string, { week_start: string; week_end: string; pre_visits: number; visits: number }>()
    for (const row of visibleWeeklyRows) {
      const current = byWeek.get(row.week_start) ?? {
        week_start: row.week_start,
        week_end: row.week_end,
        pre_visits: 0,
        visits: 0,
      }
      current.pre_visits += Number(row.pre_visits || 0)
      current.visits += Number(row.visits || 0)
      byWeek.set(row.week_start, current)
    }
    return Array.from(byWeek.values()).sort((a, b) => a.week_start.localeCompare(b.week_start))
  }, [visibleWeeklyRows])

  const totals = useMemo(() => visibleRows.reduce(
    (acc, row) => ({
      assigned: acc.assigned + Number(row.assigned_customers || 0),
      paid: acc.paid + Number(row.paid_customers || 0),
      unpaid: acc.unpaid + Number(row.unpaid_customers || 0),
      preVisits: acc.preVisits + Number(row.pre_visits || 0),
      visits: acc.visits + Number(row.visits || 0),
      attendance: acc.attendance + Number(row.attendance_days || 0),
    }),
    { assigned: 0, paid: 0, unpaid: 0, preVisits: 0, visits: 0, attendance: 0 }
  ), [visibleRows])

  const visitedCustomerTotal = useMemo(() => {
    const allowed = new Set(agents.filter(a => !organization || (a.organization || '').trim() === organization).map(a => a.email.toLowerCase()))
    return visitedCustomerRows.reduce((sum, r) => sum + (allowed.has(r.agent_email.toLowerCase()) ? Number(r.visited_customers || 0) : 0), 0)
  }, [agents, organization, visitedCustomerRows])

  const conversionsByEmail = useMemo(() => new Map(conversionRows.map(r=>[r.agent_email.toLowerCase(),r])), [conversionRows])

  function openLocations(agent:ProductivityRow) {
    setLocationAgent(agent)
    setLocationDay(endDate > today ? today : endDate)
    setLocationRows([])
    setLocationError('')
  }

  useEffect(() => {
    if (!locationAgent) return
    const selectedAgentEmail = locationAgent.agent_email.trim().toLowerCase()
    let cancelled = false
    async function loadHistory() {
      setLocationLoading(true)
      setLocationError('')
      const {data: directory, error: directoryError} = await supabase.rpc('crl_circle_agent_location_directory_v2')
      if(cancelled) return
      if(directoryError) { setLocationError(directoryError.message); setLocationLoading(false); return }
      const user = ((directory ?? []) as AuthDirectoryUser[]).find(u=>u.email?.trim().toLowerCase()===selectedAgentEmail)
      if(!user) { setLocationRows([]); setLocationError(tx('No GPS account associated with this agent.','Akun GPS agen tidak ditemukan.')); setLocationLoading(false); return }
      const start = locationDay + 'T00:00:00+07:00'
      const end = new Date(new Date(start).getTime()+86400000).toISOString()
      const {data,error} = await supabase.from('agent_location_history')
        .select('latitude,longitude,accuracy_meters,captured_at')
        .eq('agent_user_id',user.id)
        .gte('captured_at',start).lt('captured_at',end)
        .order('captured_at',{ascending:true}).limit(1000)
      if(cancelled) return
      if(error) {setLocationError(error.message);setLocationRows([])}
      else setLocationRows(((data??[]) as HistoryPoint[]).filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)))
      setLocationLoading(false)
    }
    void loadHistory()
    return ()=>{cancelled=true}
  },[locationAgent,locationDay,supabase])

  function downloadCsv() {
    const headers = [...productivityHeaders]
    const body = visibleProductivityRows.map(r=>productivityValues(r,conversionsByEmail.get(r.agent_email.toLowerCase())).map(csvCell).join(','))

    const metadata = [
      [csvCell('CRL Superadmin Report')],
      [csvCell('Start Date'), csvCell(startDate)],
      [csvCell('End Date'), csvCell(endDate)],
      [csvCell('Organization'), csvCell(organization || 'All Organizations')],
      [csvCell('Agent'), csvCell(agentEmail || 'All Agents')],
      [],
    ].map((line) => line.join(','))

    const weeklyHeaders = ['Agent Name', 'Agent Email', 'Week Start', 'Week End', 'Pre-Visits', 'Visits', 'Visit Conversion %']
    const weeklyBody = visibleWeeklyRows.map((row) => [
      row.agent_name,
      row.agent_email,
      row.week_start,
      row.week_end,
      row.pre_visits,
      row.visits,
      Number(row.visit_conversion || 0).toFixed(1),
    ].map(csvCell).join(','))

    const csv = `\uFEFF${[
      ...metadata,
      headers.map(csvCell).join(','),
      ...body,
      '',
      csvCell('Weekly Activity by Agent'),
      weeklyHeaders.map(csvCell).join(','),
      ...weeklyBody,
    ].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `crl-report-${startDate}-to-${endDate}${organization ? `-${organization.replace(/\s+/g, '-').toLowerCase()}` : ''}${agentEmail ? `-${agentEmail.split('@')[0]}` : ''}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <FileBarChart2 className="h-5 w-5" />
            {tx('Superadmin Reports', 'Laporan Superadmin')}
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            {tx('Generate Reports', 'Buat Laporan')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-base-content/60">
            {tx(
              'Review agent activity and current customer portfolio, then export the report to CSV or print/save as PDF.',
              'Tinjau aktivitas agen dan portofolio pelanggan saat ini, lalu ekspor laporan ke CSV atau cetak/simpan sebagai PDF.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className="dui-btn dui-btn-outline dui-btn-sm" onClick={() => window.print()} disabled={loading}>
            <Printer className="h-4 w-4" /> {tx('Print / PDF', 'Cetak / PDF')}
          </button>
          <button type="button" className="dui-btn dui-btn-primary dui-btn-sm" onClick={downloadCsv} disabled={loading || visibleRows.length === 0}>
            <Download className="h-4 w-4" /> {tx('Download CSV', 'Unduh CSV')}
          </button>
        </div>
      </div>

      <section className="dui-card border border-base-300 bg-base-100 shadow-sm print:hidden">
        <div className="dui-card-body gap-4">
          <div className="flex items-center gap-2 font-bold"><CalendarDays className="h-5 w-5" />{tx('Report Filters', 'Filter Laporan')}</div>
          <div className="grid gap-3 md:grid-cols-6">
            <label className="dui-fieldset">
              <span className="dui-fieldset-legend">{tx('Start date', 'Tanggal mulai')}</span>
              <input type="date" className="dui-input w-full !h-12 !min-h-12" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="dui-fieldset">
              <span className="dui-fieldset-legend">{tx('End date', 'Tanggal akhir')}</span>
              <input type="date" className="dui-input w-full !h-12 !min-h-12" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="dui-fieldset">
              <span className="dui-fieldset-legend">{tx('Organization', 'Organisasi')}</span>
              <select
                className="dui-select w-full !h-12 !min-h-12"
                value={organization}
                onChange={(e) => {
                  setOrganization(e.target.value)
                  setAgentEmail('')
                }}
              >
                <option value="">{tx('All organizations', 'Semua organisasi')}</option>
                {organizations.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="dui-fieldset">
              <span className="dui-fieldset-legend">{tx('Agent', 'Agen')}</span>
              <select className="dui-select w-full !h-12 !min-h-12" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)}>
                <option value="">{tx('All agents', 'Semua agen')}</option>
                {filteredAgents.map((agent) => <option key={agent.email} value={agent.email}>{agent.agent_name || agent.email}</option>)}
              </select>
            </label>
            <label className="dui-fieldset">
              <span className="dui-fieldset-legend">{tx('Daily visit target (optional)', 'Target kunjungan harian (opsional)')}</span>
              <input type="number" min="0" step="0.5" className="dui-input w-full !h-12 !min-h-12" placeholder="—" value={dailyTarget} onChange={e=>setDailyTarget(e.target.value)}/>
            </label>
            <div className="flex items-end">
              <button type="button" className="dui-btn dui-btn-outline w-full !h-12 !min-h-12" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {tx('Refresh', 'Muat ulang')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="text-sm font-semibold text-base-content/60">
        {tx('Period', 'Periode')}: <span className="text-base-content">{startDate} — {endDate}</span>
        {organization && <> · {tx('Organization', 'Organisasi')}: <span className="text-base-content">{organization}</span></>}
        {agentEmail && <> · {tx('Agent', 'Agen')}: <span className="text-base-content">{agentEmail}</span></>}
      </div>

      {error && <div className="dui-alert dui-alert-error"><span>{error}</span></div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Metric label={tx('Assigned', 'Ditugaskan')} value={totals.assigned} />
        <Metric label={tx('Paid', 'Lunas')} value={totals.paid} />
        <Metric label={tx('Unpaid', 'Belum Bayar')} value={totals.unpaid} />
        <Metric label={tx('Pre-Visits', 'Pra-Kunjungan')} value={totals.preVisits} />
        <Metric label={tx('Visited Customers', 'Pelanggan Dikunjungi')} value={visitedCustomerTotal} />
        <Metric label={tx('Total Visits', 'Total Kunjungan')} value={totals.visits} />
        <Metric label={tx('Attendance Days', 'Hari Absensi')} value={totals.attendance} />
      </section>

      <AgentProductivityReview
        rows={visibleProductivityRows}
        funnel={agentFunnelRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        visited={visitedCustomerRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        payments={conversionRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        loading={loading}
        locale={locale}
        dailyTarget={dailyTarget}
        startDate={startDate}
        endDate={endDate}
        onOpenLocations={openLocations}
      />
      <WeeklyAgentActivity rows={visibleWeeklyRows} loading={loading} locale={locale} startDate={startDate} endDate={endDate}
        funnel={agentFunnelRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        payments={conversionRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        visited={visitedCustomerRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
      />

      {locationAgent && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 print:hidden" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setLocationAgent(null)}}>
        <section role="dialog" aria-modal="true" aria-label={tx('Agent GPS Movement','Pergerakan GPS Agen')} className="dui-card max-h-[90vh] w-full max-w-4xl overflow-y-auto bg-base-100 shadow-xl">
          <div className="dui-card-body gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold">{locationAgent.agent_name || locationAgent.agent_email}</h2><p className="text-xs text-base-content/60">{tx('Recorded GPS movement by timestamp (WIB)','Pergerakan GPS berdasarkan waktu (WIB)')}</p></div>
              <div className="flex items-center gap-2">
                <input type="date" className="dui-input dui-input-sm" aria-label={tx('Movement date','Tanggal pergerakan')} min={startDate} max={endDate > today ? today : endDate} value={locationDay} onChange={e=>setLocationDay(e.target.value)}/>
                <button type="button" className="dui-btn dui-btn-ghost dui-btn-sm" onClick={()=>setLocationAgent(null)}><X className="h-4 w-4"/>{tx('Close','Tutup')}</button>
              </div>
            </div>
            {locationError && <p role="alert" className="text-sm text-error">{locationError}</p>}
            {locationLoading ? <p className="p-6">{tx('Loading GPS points...','Memuat titik GPS...')}</p>
            : locationRows.length ? <>
              <AgentMovementMap points={locationRows} locale={locale}/>
              <div className="flex flex-wrap items-center gap-3 text-xs"><span>🔵 {tx('First','Awal')}</span><span>🟣 {tx('Intermediate','Pertengahan')}</span><span>🔴 {tx('Latest','Terakhir')}</span><span>🟠 {tx('Low accuracy','Akurasi rendah')}</span><strong>{locationRows.length} {tx('recorded points','titik terekam')}</strong></div>
              <div className="max-h-48 overflow-auto"><table className="dui-table dui-table-xs"><thead><tr><th>#</th><th>{tx('Time (WIB)','Waktu (WIB)')}</th><th>Latitude</th><th>Longitude</th><th>{tx('Accuracy','Akurasi')}</th></tr></thead><tbody>{locationRows.map((p,i)=><tr key={p.captured_at+'-'+i}><td>{i+1}</td><td>{new Date(p.captured_at).toLocaleString(locale==='id'?'id-ID':'en-GB',{timeZone:'Asia/Jakarta',hour12:false})}</td><td>{p.latitude.toFixed(6)}</td><td>{p.longitude.toFixed(6)}</td><td>{p.accuracy_meters==null?'—':Math.round(p.accuracy_meters)+' m'}</td></tr>)}</tbody></table></div>
            </> : !locationLoading && !locationError ? <p className="p-6 text-sm">{tx('No recorded GPS points for this date.','Tidak ada titik GPS tercatat pada tanggal ini.')}</p> : null}
          </div>
        </section>
      </div>}
      <p className="text-xs text-base-content/60">{tx('Paid after visit/previsit is attributed to the most recent eligible activity, preferring a prior visit, when payment_date exists and payment happened afterward. The selected date range applies to the activity date.','Pembayaran setelah visit/previsit diatribusikan ke aktivitas terkait (mendahulukan visit), jika payment_date tersedia dan pembayaran terjadi setelahnya. Rentang tanggal berlaku pada tanggal aktivitas.')}</p>
      <p className="text-xs text-base-content/60">{tx('Target attainment is blank until a daily visit target is entered. Missing checkout excludes today. Long gap means more than 3 hours between check-in and successive recorded pre-visit/visit events, not proof of inactivity.', 'Pencapaian target kosong sampai target harian diisi. Checkout hilang tidak menghitung hari ini. Jeda >3 jam dihitung dari check-in dan antar aktivitas pra-kunjungan/kunjungan yang tercatat, bukan bukti tidak bekerja.')}</p>

      <p className="text-xs text-base-content/50">
        {tx(
          'Customer counts show the current portfolio. Pre-Visit, Visit and Attendance counts follow the selected report period (WIB).',
          'Jumlah pelanggan menunjukkan portofolio saat ini. Jumlah Pra-Kunjungan, Kunjungan, dan Absensi mengikuti periode laporan yang dipilih (WIB).'
        )}
      </p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="dui-card border border-base-300 bg-base-100 shadow-sm"><div className="dui-card-body gap-1 p-4"><span className="text-xs font-bold uppercase tracking-wide text-base-content/50">{label}</span><strong className="text-2xl font-black">{value.toLocaleString()}</strong></div></div>
}

function formatMinutes(minutes: number, locale: 'en' | 'id') {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return locale === 'id' ? `${hours}j ${mins}m` : `${hours}h ${mins}m`
}
