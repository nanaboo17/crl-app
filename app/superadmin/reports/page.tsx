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

type AttendanceBreakdown = {agent_email:string;on_time_days:number;late_days:number;sick_days:number;permission_days:number}
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
  const [attendanceBreakdown, setAttendanceBreakdown] = useState<AttendanceBreakdown[]>([])
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

    const [agentResult, reportResult, weeklyResult, conversionResult, productivityResult, visitedResult, funnelResult, attendanceResult] = await Promise.all([
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
      supabase.rpc('crl_report_attendance_breakdown_v1', {p_start_date:startDate,p_end_date:endDate,p_agent_email:agentEmail||null}),
    ])

    // Keep successful report sections visible if one expensive RPC times out.
    setAgents((agentResult.data ?? []) as AgentOption[])
    setRows(reportResult.error ? [] : (reportResult.data ?? []) as ReportRow[])
    setWeeklyRows(weeklyResult.error ? [] : (weeklyResult.data ?? []) as WeeklyReportRow[])
    setConversionRows(conversionResult.error ? [] : (conversionResult.data ?? []) as PaymentConversion[])
    setProductivityRows(productivityResult.error ? [] : (productivityResult.data ?? []) as ProductivityRow[])
    setVisitedCustomerRows(visitedResult.error ? [] : (visitedResult.data ?? []) as VisitedCustomerCount[])
    setAgentFunnelRows(funnelResult.error ? [] : (funnelResult.data ?? []) as AgentFunnelCount[])
    setAttendanceBreakdown(attendanceResult.error ? [] : (attendanceResult.data ?? []) as AttendanceBreakdown[])

    const failed = [
      agentResult.error && tx('Agent directory', 'Direktori agen'),
      reportResult.error && tx('Overview', 'Ringkasan'),
      weeklyResult.error && tx('Weekly activity', 'Aktivitas mingguan'),
      conversionResult.error && tx('Payment conversions', 'Konversi pembayaran'),
      productivityResult.error && tx('Productivity', 'Produktivitas'),
      visitedResult.error && tx('Visited customers', 'Pelanggan dikunjungi'),
      funnelResult.error && tx('Recovery funnel', 'Funnel pemulihan'),
      attendanceResult.error && tx('Attendance breakdown','Rincian absensi'),
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

  const inOrg=(email:string)=>!organization||agents.some(a=>a.email.toLowerCase()===email.toLowerCase()&&(a.organization||'').trim()===organization)
  const visibleFunnel=agentFunnelRows.filter(r=>inOrg(r.agent_email))
  const visibleAttendance=attendanceBreakdown.filter(r=>inOrg(r.agent_email))
  const visiblePayments=conversionRows.filter(r=>inOrg(r.agent_email))
  const visibleVisited=visitedCustomerRows.filter(r=>inOrg(r.agent_email))
  const funnelByEmail=new Map(visibleFunnel.map(r=>[r.agent_email.toLowerCase(),r]))
  const attendanceByEmail=new Map(visibleAttendance.map(r=>[r.agent_email.toLowerCase(),r]))
  const visitedByEmail=new Map(visibleVisited.map(r=>[r.agent_email.toLowerCase(),r]))
  const portfolioInfo=[
    {group:'Portfolio',title:tx('Assigned','Ditugaskan'),value:totals.assigned,description:tx('Current assigned portfolio, not a historical cohort','Portofolio penugasan saat ini, bukan kohort historis')},
    {group:'Portfolio',title:tx('Unpaid','Belum bayar'),value:totals.unpaid,description:tx('Currently unpaid among assigned customers','Belum bayar dari pelanggan yang ditugaskan')},
    {group:'Recovery',title:tx('Paid portfolio','Portofolio lunas'),value:totals.paid,description:tx('Current payment status, not paid-after-visit','Status pembayaran saat ini, bukan pembayaran setelah kunjungan')},
    {group:'Field Activity',title:'Pre-Visits',value:totals.preVisits,description:tx('Recorded pre-visit submissions within period','Pengisian pre-visit selama periode')},
    {group:'Field Activity',title:tx('Unique visited','Pelanggan dikunjungi'),value:visitedCustomerTotal,description:tx('Distinct CRL cases per agent in period','Kasus CRL unik per agen dalam periode')},
    {group:'Field Activity',title:tx('Total visits','Total kunjungan'),value:totals.visits,description:tx('Includes follow-up and repeat visits','Termasuk kunjungan ulang')},
    {group:'Attendance',title:tx('Attendance days','Hari hadir'),value:totals.attendance,description:tx('Total agent-days with attendance records','Total hari hadir dari seluruh agen')},
  ]
  const exportAgentRows=visibleProductivityRows.map(r=>{
    const key=r.agent_email.toLowerCase(),fu=funnelByEmail.get(key),att=attendanceByEmail.get(key),v=visitedByEmail.get(key),pay=conversionsByEmail.get(key)
    const met=Number(fu?.unique_met||0),ptp=Number(fu?.unique_ptp||0),unique=Number(v?.visited_customers||0),paid=Number(pay?.paid_after_visit||0)+Number(pay?.paid_after_previsit||0)
    return {r,fu,att,unique,met,ptp,paid,
      record:[r.agent_name||'',r.agent_email,r.assigned_leads,fu?.unique_previsits||0,r.total_visits,unique,met,ptp,paid,
      r.attendance_days,att?.on_time_days||0,att?.late_days||0,att?.sick_days||0,att?.permission_days||0,
      r.no_activity_attendance_days,r.missing_checkout_days,r.long_gap_days,
      r.visits_per_attendance_day??'',r.target_attainment??'',
      unique? (met/unique*100).toFixed(1):'',met?(ptp/met*100).toFixed(1):'',unique?(paid/unique*100).toFixed(1):'',
      r.first_pre_visit||'',r.first_visit||'',r.review]}
  })
  function downloadCsv() {
    const agentColumns=['Agent','Email','Assigned (current portfolio)','Unique Pre-Visit','Total Visits','Unique Visited','Unique Met','Unique P2P','Paid After Activity','Attendance Days','On-Time Days','Late Days','Sick Days (approved)','Permission Days (approved)','No Activity Days','Missing Checkout Days','Long Gaps >3h','Visits / Attendance Day','Target Attainment %','Meeting Rate %','P2P Rate %','Recovery Rate %','First Pre-Visit Today (WIB timestamp)','First Visit Today (WIB timestamp)','Review']
    const weeks=new Map<string,{start:string;end:string;pre:number;visits:number}>()
    for(const row of visibleWeeklyRows){const w=weeks.get(row.week_start)||{start:row.week_start,end:row.week_end,pre:0,visits:0};w.pre+=Number(row.pre_visits||0);w.visits+=Number(row.visits||0);weeks.set(row.week_start,w)}
    const weekly=[...weeks.values()].sort((a,b)=>a.start.localeCompare(b.start))
    const toCsv=(values:(string|number|null|undefined)[])=>values.map(csvCell).join(',')
    const lines=[
      toCsv(['CRL Superadmin Reports']),toCsv(['Start Date',startDate]),toCsv(['End Date',endDate]),
      toCsv(['Organization',organization||'All Organizations']),toCsv(['Agent',agentEmail||'All Agents']), '',
      toCsv(['SUMMARY KPIS']),toCsv(['Group','Metric','Value','Definition']),
      ...portfolioInfo.map(v=>toCsv([v.group,v.title,v.value,v.description])), '',
      toCsv(['AGENT FUNNEL / ATTENDANCE / PRODUCTIVITY / REVIEW']),toCsv(agentColumns),
      ...exportAgentRows.map(x=>toCsv(x.record)), '',
      toCsv(['WEEKLY PERFORMANCE TREND']),toCsv(['Week Start (clipped)','Week End (clipped)','Pre-Visits','Visits','Visits / PV (%)']),
      ...weekly.map(w=>toCsv([w.start<startDate?startDate:w.start,w.end>endDate?endDate:w.end,w.pre,w.visits,w.pre?(w.visits/w.pre*100).toFixed(1):''])),
      '',toCsv(['WEEKLY AGENT ACTIVITY (detail)']),toCsv(['Agent','Email','Week Start','Week End','Pre-Visits','Visits']),
      ...visibleWeeklyRows.map(w=>toCsv([w.agent_name||'',w.agent_email,w.week_start<startDate?startDate:w.week_start,w.week_end>endDate?endDate:w.week_end,w.pre_visits,w.visits])),
      '',toCsv(['Export notes','Counts for assigned and paid portfolio are current; field activity is filtered by selected dates.']),
      toCsv(['Export notes','Total visits include repeats; distinct cases are per agent. Paid after activity is attribution, not a strict sequential funnel.'])
    ]
    const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8;'})
    const url=URL.createObjectURL(blob),link=document.createElement('a')
    link.href=url
    link.download=`crl-report-${startDate}-to-${endDate}.csv`
    document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url)
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
          <button type="button" className="dui-btn dui-btn-primary dui-btn-sm" onClick={downloadCsv} disabled={loading || (visibleRows.length === 0 && visibleProductivityRows.length === 0)}>
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(['Portfolio','Field Activity','Recovery','Attendance'] as const).map(group=><div key={group} className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-black">{group==='Portfolio'?tx('Customer Portfolio','Portofolio Pelanggan'):group==='Field Activity'?tx('Field Activity','Aktivitas Lapangan'):group==='Recovery'?tx('Recovery Outcome','Hasil Pemulihan'):tx('Attendance','Kehadiran')}</h2>
          <div className="grid grid-cols-2 gap-3">{portfolioInfo.filter(k=>k.group===group).map(k=><div key={k.title} className="min-w-0 rounded-xl bg-base-200/60 p-3" title={k.description}><p className="text-xs font-semibold opacity-70">{k.title}</p><p className="mt-1 text-2xl font-black tabular-nums">{k.value.toLocaleString('id-ID')}</p><p className="mt-1 text-[11px] leading-relaxed opacity-60">{k.description}</p></div>)}</div>
        </div>)}
      </section>
      <AgentProductivityReview
        rows={visibleProductivityRows}
        funnel={agentFunnelRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        visited={visitedCustomerRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        payments={conversionRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        loading={loading}
        locale={locale}
        dailyTarget={dailyTarget}
        attendanceBreakdown={visibleAttendance}
        startDate={startDate}
        endDate={endDate}
        onOpenLocations={openLocations}
      />
      <section className="hidden print:block">
        <h2 className="mb-2 text-lg font-black">Agent Performance · Funnel / Attendance / Productivity / Review</h2>
        <p className="mb-3 text-xs">{startDate} — {endDate} · {organization || 'All organizations'} · {agentEmail || 'All agents'}</p>
        <table className="w-full border-collapse text-[8px]">
          <thead><tr>{['Agent','Assigned','Pre-Visit (unique)','Visits','Unique','Met','P2P','Paid after activity','Attendance','On time','Late','Sick','Permission','No activity','Missing checkout','Long gaps'].map(h=><th key={h} className="border p-1 text-left">{h}</th>)}</tr></thead>
          <tbody>{exportAgentRows.map(({r,fu,att,unique,met,ptp,paid})=><tr key={r.agent_email}>{[r.agent_name||r.agent_email,r.assigned_leads,fu?.unique_previsits||0,r.total_visits,unique,met,ptp,paid,r.attendance_days,att?.on_time_days||0,att?.late_days||0,att?.sick_days||0,att?.permission_days||0,r.no_activity_attendance_days,r.missing_checkout_days,r.long_gap_days].map((value,i)=><td key={i} className="border p-1">{value}</td>)}</tr>)}</tbody>
        </table>
      </section>
      <WeeklyAgentActivity rows={visibleWeeklyRows} loading={loading} locale={locale} startDate={startDate} endDate={endDate}
        funnel={agentFunnelRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        payments={conversionRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        visited={visitedCustomerRows.filter(r => !organization || agents.some(a => a.email.toLowerCase() === r.agent_email.toLowerCase() && (a.organization || '').trim() === organization))}
        productivity={visibleProductivityRows}
        comparisonEnd={today}
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

