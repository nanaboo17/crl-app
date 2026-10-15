'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Download,
  FileBarChart2,
  Printer,
  RefreshCw,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import WeeklyAgentActivity from './WeeklyAgentActivity'

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

type ProductivityRow = {
  agent_email: string; agent_name: string | null; assigned_leads: number;
  attendance_days: number; no_activity_attendance_days: number; pre_visit_days: number;
  field_visit_days: number; pre_visit_customer_days: number; total_visits: number;
  visits_per_attendance_day: number | null; visits_per_field_day: number | null;
  target_attainment: number | null; met: number; ptp: number; missing_checkout_days: number;
  long_gap_days: number; first_pre_visit: string | null; first_visit: string | null; review: string;
}
const productivityHeaders = ['CRL Agent','Email','Assigned Leads','Attendance Days','No-Activity Attendance Days','Pre-Visit Days','Field Visit Days','Pre-Visit Customer-Days','Total Visits','Visits / Attendance Day','Visits / Field Day','Target Attainment','Met','PTP','Missing Checkout Days','Long Gap Days >3h','First Pre-Visit','First Visit','Review'] as const
function productivityValues(r:ProductivityRow) {
 return [r.agent_name,r.agent_email,r.assigned_leads,r.attendance_days,r.no_activity_attendance_days,
 r.pre_visit_days,r.field_visit_days,r.pre_visit_customer_days,r.total_visits,
 r.visits_per_attendance_day,r.visits_per_field_day,r.target_attainment==null?'':r.target_attainment+'%',
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const [agentResult, reportResult, weeklyResult, productivityResult] = await Promise.all([
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
      supabase.rpc('get_superadmin_agent_productivity', {
        p_start_date: startDate, p_end_date: endDate,
        p_agent_email: agentEmail || null,
        p_daily_visit_target: Number(dailyTarget)>0 ? Number(dailyTarget) : null,
      }),
    ])

    if (agentResult.error) {
      setError(agentResult.error.message)
      setLoading(false)
      return
    }
    if (reportResult.error) {
      setError(reportResult.error.message)
      setLoading(false)
      return
    }
    if (weeklyResult.error) {
      setError(weeklyResult.error.message)
      setLoading(false)
      return
    }

    if (productivityResult.error) { setError(productivityResult.error.message); setLoading(false); return }
    setProductivityRows((productivityResult.data ?? []) as ProductivityRow[])
    setAgents((agentResult.data ?? []) as AgentOption[])
    setRows((reportResult.data ?? []) as ReportRow[])
    setWeeklyRows((weeklyResult.data ?? []) as WeeklyReportRow[])
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

  function downloadCsv() {
    const headers = [...productivityHeaders]
    const body = visibleProductivityRows.map(r=>productivityValues(r).map(csvCell).join(','))

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
              <input type="date" className="dui-input w-full" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="dui-fieldset">
              <span className="dui-fieldset-legend">{tx('End date', 'Tanggal akhir')}</span>
              <input type="date" className="dui-input w-full" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="dui-fieldset">
              <span className="dui-fieldset-legend">{tx('Organization', 'Organisasi')}</span>
              <select
                className="dui-select w-full"
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
              <select className="dui-select w-full" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)}>
                <option value="">{tx('All agents', 'Semua agen')}</option>
                {filteredAgents.map((agent) => <option key={agent.email} value={agent.email}>{agent.agent_name || agent.email}</option>)}
              </select>
            </label>
            <label className="dui-fieldset">
              <span className="dui-fieldset-legend">{tx('Daily visit target (optional)', 'Target kunjungan harian (opsional)')}</span>
              <input type="number" min="0" step="0.5" className="dui-input w-full" placeholder="—" value={dailyTarget} onChange={e=>setDailyTarget(e.target.value)}/>
            </label>
            <div className="flex items-end">
              <button type="button" className="dui-btn dui-btn-outline w-full" onClick={() => void load()} disabled={loading}>
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label={tx('Assigned', 'Ditugaskan')} value={totals.assigned} />
        <Metric label={tx('Paid', 'Lunas')} value={totals.paid} />
        <Metric label={tx('Unpaid', 'Belum Bayar')} value={totals.unpaid} />
        <Metric label={tx('Pre-Visits', 'Pra-Kunjungan')} value={totals.preVisits} />
        <Metric label={tx('Visits', 'Kunjungan')} value={totals.visits} />
        <Metric label={tx('Attendance Days', 'Hari Absensi')} value={totals.attendance} />
      </section>

      <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-card-body gap-3 p-0 sm:p-0">
          <div className="flex items-center gap-2 px-4 pt-4 font-bold sm:px-5 sm:pt-5">
            <CalendarDays className="h-5 w-5" /> {tx('Weekly Field Activity', 'Aktivitas Lapangan Mingguan')}
          </div>
          <div className="overflow-x-auto">
            <table className="dui-table dui-table-zebra min-w-[640px] text-xs sm:text-sm">
              <thead><tr>
                <th>{tx('Week', 'Minggu')}</th>
                <th>{tx('Pre-Visits', 'Pra-Kunjungan')}</th>
                <th>{tx('Visits', 'Kunjungan')}</th>
                <th>{tx('Visit Conversion', 'Konversi Kunjungan')}</th>
              </tr></thead>
              <tbody>
                {weeklyTotals.map((row) => {
                  const conversion = row.pre_visits > 0 ? (row.visits / row.pre_visits) * 100 : 0
                  return <tr key={row.week_start}>
                    <td className="font-bold">{row.week_start} — {row.week_end}</td>
                    <td>{row.pre_visits}</td>
                    <td>{row.visits}</td>
                    <td>{conversion.toFixed(1)}%</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <WeeklyAgentActivity rows={visibleWeeklyRows} loading={loading} locale={locale} />

      <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-card-body gap-3 p-0 sm:p-0">
          <div className="flex items-center gap-2 px-4 pt-4 font-bold sm:px-5 sm:pt-5"><Users className="h-5 w-5"/> {tx('Agent Productivity & Review', 'Produktivitas dan Evaluasi Agen')}</div>
          {loading ? <div className="py-12 text-center"><span className="dui-loading dui-loading-spinner dui-loading-lg"/></div>
          : <div className="max-w-full overflow-x-auto"><table className="dui-table dui-table-zebra min-w-[2450px] text-xs">
            <thead><tr>{productivityHeaders.map(h=><th key={h} className="whitespace-normal">{h}</th>)}</tr></thead>
            <tbody>{visibleProductivityRows.map(r=><tr key={r.agent_email} className={r.review==='Review'?'bg-warning/5':''}>
              {productivityValues(r).map((v,i)=><td key={i} className={i===0?'font-bold':''}>{(i===16||i===17) && v ? new Date(String(v)).toLocaleString(locale==='id'?'id-ID':'en-GB',{timeZone:'Asia/Jakarta'}):v ?? '—'}</td>)}
            </tr>)}</tbody>
          </table>{visibleProductivityRows.length===0&&<div className="p-6 text-sm">{tx('No report data.', 'Tidak ada data laporan.')}</div>}</div>}
        </div>
      </section>
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
