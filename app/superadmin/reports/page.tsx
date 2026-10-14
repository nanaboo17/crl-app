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
  const [weeklyRows, setWeeklyRows] = useState<WeeklyReportRow[]>([])
  const [weeklyWeek, setWeeklyWeek] = useState('')
  const [weeklyPage, setWeeklyPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const [agentResult, reportResult, weeklyResult] = await Promise.all([
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

    setAgents((agentResult.data ?? []) as AgentOption[])
    setRows((reportResult.data ?? []) as ReportRow[])
    setWeeklyRows((weeklyResult.data ?? []) as WeeklyReportRow[])
    setLoading(false)
  }, [agentEmail, endDate, startDate, supabase])

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

  const visibleWeeklyRows = useMemo(() => {
    if (!organization) return weeklyRows
    const allowed = new Set(
      agents
        .filter((agent) => (agent.organization || '').trim() === organization)
        .map((agent) => agent.email.toLowerCase())
    )
    return weeklyRows.filter((row) => allowed.has(row.agent_email.toLowerCase()))
  }, [agents, organization, weeklyRows])


  const weeklyWeekOptions = useMemo(() => Array.from(
    new Map(
      visibleWeeklyRows.map((row) => [
        row.week_start,
        { week_start: row.week_start, week_end: row.week_end },
      ])
    ).values()
  ).sort((a, b) => b.week_start.localeCompare(a.week_start)), [visibleWeeklyRows])

  const filteredWeeklyRows = useMemo(
    () => weeklyWeek
      ? visibleWeeklyRows.filter((row) => row.week_start === weeklyWeek)
      : visibleWeeklyRows,
    [visibleWeeklyRows, weeklyWeek]
  )

  const WEEKLY_PAGE_SIZE = 10
  const weeklyTotalPages = Math.max(1, Math.ceil(filteredWeeklyRows.length / WEEKLY_PAGE_SIZE))
  const safeWeeklyPage = Math.min(weeklyPage, weeklyTotalPages)
  const paginatedWeeklyRows = filteredWeeklyRows.slice(
    (safeWeeklyPage - 1) * WEEKLY_PAGE_SIZE,
    safeWeeklyPage * WEEKLY_PAGE_SIZE
  )

  useEffect(() => {
    setWeeklyPage(1)
  }, [weeklyWeek, organization, agentEmail, startDate, endDate])

  useEffect(() => {
    if (weeklyPage > weeklyTotalPages) setWeeklyPage(weeklyTotalPages)
  }, [weeklyPage, weeklyTotalPages])

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


  const chartWeekStart = weeklyWeek || weeklyWeekOptions[0]?.week_start || ''
  const chartAgentRows = useMemo(
    () => visibleWeeklyRows
      .filter((row) => row.week_start === chartWeekStart)
      .sort((a, b) => (Number(b.visits || 0) + Number(b.pre_visits || 0)) - (Number(a.visits || 0) + Number(a.pre_visits || 0)))
      .slice(0, 10),
    [chartWeekStart, visibleWeeklyRows]
  )

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
    const headers = [
      'Agent Name',
      'Agent Email',
      'Organization',
      'Assigned Customers',
      'Paid Customers',
      'Unpaid Customers',
      'P1',
      'P2',
      'P3',
      'P4',
      'P5',
      'Pre-Visits',
      'Ready for Visit',
      'Direct Visit',
      'Visits',
      'Paid Conversations',
      'Promise to Pay',
      'Attendance Days',
      'Average Worked Minutes',
    ]

    const organizationByEmail = new Map(agents.map((agent) => [agent.email.toLowerCase(), agent.organization || '']))
    const body = visibleRows.map((row) => [
      row.agent_name,
      row.agent_email,
      organizationByEmail.get(row.agent_email.toLowerCase()) || '',
      row.assigned_customers,
      row.paid_customers,
      row.unpaid_customers,
      row.p1_customers,
      row.p2_customers,
      row.p3_customers,
      row.p4_customers,
      row.p5_customers,
      row.pre_visits,
      row.ready_for_visit,
      row.direct_visit,
      row.visits,
      row.paid_conversations,
      row.promise_to_pay,
      row.attendance_days,
      row.average_worked_minutes,
    ].map(csvCell).join(','))

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
          <div className="grid gap-3 md:grid-cols-5">
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

      <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-card-body gap-4 p-0 sm:p-0">
          <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-end sm:justify-between sm:px-5 sm:pt-5">
            <div className="flex items-center gap-2 font-bold">
              <Users className="h-5 w-5" /> {tx('Weekly Activity by Agent', 'Aktivitas Mingguan per Agen')}
            </div>
            <label className="dui-fieldset w-full sm:w-72">
              <span className="dui-fieldset-legend">{tx('Filter week', 'Filter minggu')}</span>
              <select
                className="dui-select w-full"
                value={weeklyWeek}
                onChange={(e) => setWeeklyWeek(e.target.value)}
              >
                <option value="">{tx('All weeks', 'Semua minggu')}</option>
                {weeklyWeekOptions.map((week) => (
                  <option key={week.week_start} value={week.week_start}>
                    {week.week_start} — {week.week_end}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><span className="dui-loading dui-loading-spinner dui-loading-lg" /></div>
          ) : visibleWeeklyRows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-base-content/60">{tx('No weekly activity for this period.', 'Tidak ada aktivitas mingguan untuk periode ini.')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="dui-table dui-table-zebra min-w-[820px] text-xs sm:text-sm">
                <thead><tr>
                  <th>{tx('Agent', 'Agen')}</th>
                  <th>{tx('Week', 'Minggu')}</th>
                  <th>{tx('Pre-Visits', 'Pra-Kunjungan')}</th>
                  <th>{tx('Visits', 'Kunjungan')}</th>
                  <th>{tx('Visit Conversion', 'Konversi Kunjungan')}</th>
                </tr></thead>
                <tbody>
                  {paginatedWeeklyRows.map((row) => <tr key={`${row.agent_email}-${row.week_start}`}>
                    <td><div className="font-bold">{row.agent_name || '—'}</div><div className="text-[11px] text-base-content/50">{row.agent_email}</div></td>
                    <td>{row.week_start} — {row.week_end}</td>
                    <td>{row.pre_visits}</td>
                    <td>{row.visits}</td>
                    <td>{Number(row.visit_conversion || 0).toFixed(1)}%</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filteredWeeklyRows.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-base-300 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="text-xs font-semibold text-base-content/60">
                {tx('Showing', 'Menampilkan')} {(safeWeeklyPage - 1) * WEEKLY_PAGE_SIZE + 1}–{Math.min(safeWeeklyPage * WEEKLY_PAGE_SIZE, filteredWeeklyRows.length)}
                {' '}{tx('of', 'dari')} {filteredWeeklyRows.length}
              </div>
              <div className="dui-join">
                <button
                  type="button"
                  className="dui-btn dui-btn-sm dui-join-item"
                  disabled={safeWeeklyPage <= 1}
                  onClick={() => setWeeklyPage((page) => Math.max(1, page - 1))}
                >
                  {tx('Previous', 'Sebelumnya')}
                </button>
                <button type="button" className="dui-btn dui-btn-sm dui-join-item pointer-events-none">
                  {safeWeeklyPage} / {weeklyTotalPages}
                </button>
                <button
                  type="button"
                  className="dui-btn dui-btn-sm dui-join-item"
                  disabled={safeWeeklyPage >= weeklyTotalPages}
                  onClick={() => setWeeklyPage((page) => Math.min(weeklyTotalPages, page + 1))}
                >
                  {tx('Next', 'Berikutnya')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="dui-card border border-base-300 bg-base-100 shadow-sm">
          <div className="dui-card-body gap-4">
            <div>
              <div className="font-bold">{tx('Weekly Activity Trend', 'Tren Aktivitas Mingguan')}</div>
              <div className="text-xs text-base-content/50">{tx('Pre-Visits and Visits by week for the current filters.', 'Pra-Kunjungan dan Kunjungan per minggu sesuai filter saat ini.')}</div>
            </div>
            <div className="space-y-4">
              {weeklyTotals.map((row) => {
                const maxValue = Math.max(1, ...weeklyTotals.flatMap((item) => [Number(item.pre_visits || 0), Number(item.visits || 0)]))
                return <div key={row.week_start} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold">{row.week_start} — {row.week_end}</span>
                    <span className="text-base-content/50">{row.pre_visits} / {row.visits}</span>
                  </div>
                  <div className="grid grid-cols-[76px_1fr] items-center gap-2 text-[11px]">
                    <span>{tx('Pre-Visits', 'Pra-Kunjungan')}</span>
                    <div className="h-3 rounded-full bg-base-200">
                      <div className="h-3 rounded-full bg-primary" style={{ width: `${(Number(row.pre_visits || 0) / maxValue) * 100}%` }} />
                    </div>
                    <span>{tx('Visits', 'Kunjungan')}</span>
                    <div className="h-3 rounded-full bg-secondary" style={{ width: `${(Number(row.visits || 0) / maxValue) * 100}%` }} />
                    </div>
                  </div>
                </div>
              })}
            </div>
          </div>
        </div>

        <div className="dui-card border border-base-300 bg-base-100 shadow-sm">
          <div className="dui-card-body gap-4">
            <div>
              <div className="font-bold">{tx('Top Agent Activity', 'Aktivitas Agen Teratas')}</div>
              <div className="text-xs text-base-content/50">
                {chartWeekStart ? `${chartWeekStart} — ${weeklyWeekOptions.find((week) => week.week_start === chartWeekStart)?.week_end || chartWeekStart}` : tx('No week available', 'Tidak ada minggu tersedia')}
              </div>
            </div>
            <div className="space-y-3">
              {chartAgentRows.map((row) => {
                const maxValue = Math.max(1, ...chartAgentRows.flatMap((item) => [Number(item.pre_visits || 0), Number(item.visits || 0)]))
                return <div key={row.agent_email} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-semibold">{row.agent_name || row.agent_email}</span>
                    <span className="shrink-0 text-base-content/50">{row.pre_visits} PV · {row.visits} V</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="h-2.5 rounded-full bg-base-200">
                      <div className="h-2.5 rounded-full bg-primary" style={{ width: `${(Number(row.pre_visits || 0) / maxValue) * 100}%` }} />
                    </div>
                    <div className="h-2.5 rounded-full bg-base-200">
                      <div className="h-2.5 rounded-full bg-secondary" style={{ width: `${(Number(row.visits || 0) / maxValue) * 100}%` }} />
                    </div>
                  </div>
                </div>
              })}
            </div>
            <div className="flex gap-4 text-[11px] text-base-content/60">
              <span><span className="mr-1 inline-block size-2 rounded-sm bg-primary" />{tx('Pre-Visits', 'Pra-Kunjungan')}</span>
              <span><span className="mr-1 inline-block size-2 rounded-sm bg-secondary" />{tx('Visits', 'Kunjungan')}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-card-body gap-3 p-0 sm:p-0">
          <div className="flex items-center gap-2 px-4 pt-4 font-bold sm:px-5 sm:pt-5">
            <Users className="h-5 w-5" /> {tx('Agent Performance', 'Kinerja Agen')}
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><span className="dui-loading dui-loading-spinner dui-loading-lg" /></div>
          ) : visibleRows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-base-content/60">{tx('No report data for this period.', 'Tidak ada data laporan untuk periode ini.')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="dui-table dui-table-zebra min-w-[1350px] text-xs sm:text-sm">
                <thead>
                  <tr>
                    <th>{tx('Agent', 'Agen')}</th>
                    <th>{tx('Organization', 'Organisasi')}</th>
                    <th>{tx('Assigned', 'Ditugaskan')}</th>
                    <th>{tx('Paid', 'Lunas')}</th>
                    <th>{tx('Unpaid', 'Belum Bayar')}</th>
                    <th>P1</th><th>P2</th><th>P3</th><th>P4</th><th>P5</th>
                    <th>{tx('Pre-Visits', 'Pra-Kunjungan')}</th>
                    <th>{tx('Ready', 'Siap')}</th>
                    <th>{tx('Direct', 'Langsung')}</th>
                    <th>{tx('Visits', 'Kunjungan')}</th>
                    <th>{tx('Paid Conv.', 'Percakapan Lunas')}</th>
                    <th>PTP</th>
                    <th>{tx('Attendance', 'Absensi')}</th>
                    <th>{tx('Avg. Work', 'Rata-rata Kerja')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const agent = agents.find((item) => item.email.toLowerCase() === row.agent_email.toLowerCase())
                    return (
                      <tr key={row.agent_email}>
                        <td><div className="font-bold">{row.agent_name || '—'}</div><div className="text-[11px] text-base-content/50">{row.agent_email}</div></td>
                        <td>{agent?.organization || '—'}</td>
                        <td>{row.assigned_customers}</td>
                        <td>{row.paid_customers}</td>
                        <td>{row.unpaid_customers}</td>
                        <td>{row.p1_customers}</td><td>{row.p2_customers}</td><td>{row.p3_customers}</td><td>{row.p4_customers}</td><td>{row.p5_customers}</td>
                        <td>{row.pre_visits}</td>
                        <td>{row.ready_for_visit}</td>
                        <td>{row.direct_visit}</td>
                        <td>{row.visits}</td>
                        <td>{row.paid_conversations}</td>
                        <td>{row.promise_to_pay}</td>
                        <td>{row.attendance_days}</td>
                        <td>{formatMinutes(Number(row.average_worked_minutes || 0), locale)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

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
