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
  const [agentEmail, setAgentEmail] = useState('')
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const [agentResult, reportResult] = await Promise.all([
      supabase
        .from('agents')
        .select('email,agent_name')
        .eq('role', 'agent')
        .eq('active', true)
        .order('agent_name'),
      supabase.rpc('get_superadmin_report', {
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

    setAgents((agentResult.data ?? []) as AgentOption[])
    setRows((reportResult.data ?? []) as ReportRow[])
    setLoading(false)
  }, [agentEmail, endDate, startDate, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => rows.reduce(
    (acc, row) => ({
      assigned: acc.assigned + Number(row.assigned_customers || 0),
      paid: acc.paid + Number(row.paid_customers || 0),
      unpaid: acc.unpaid + Number(row.unpaid_customers || 0),
      preVisits: acc.preVisits + Number(row.pre_visits || 0),
      visits: acc.visits + Number(row.visits || 0),
      attendance: acc.attendance + Number(row.attendance_days || 0),
    }),
    { assigned: 0, paid: 0, unpaid: 0, preVisits: 0, visits: 0, attendance: 0 }
  ), [rows])

  function downloadCsv() {
    const headers = [
      'Agent Name',
      'Agent Email',
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

    const body = rows.map((row) => [
      row.agent_name,
      row.agent_email,
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
      [csvCell('Agent'), csvCell(agentEmail || 'All Agents')],
      [],
    ].map((line) => line.join(','))

    const csv = `\uFEFF${[...metadata, headers.map(csvCell).join(','), ...body].join('\r\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `crl-report-${startDate}-to-${endDate}${agentEmail ? `-${agentEmail.split('@')[0]}` : ''}.csv`
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
          <button type="button" className="dui-btn dui-btn-primary dui-btn-sm" onClick={downloadCsv} disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4" /> {tx('Download CSV', 'Unduh CSV')}
          </button>
        </div>
      </div>

      <section className="dui-card border border-base-300 bg-base-100 shadow-sm print:hidden">
        <div className="dui-card-body gap-4">
          <div className="flex items-center gap-2 font-bold"><CalendarDays className="h-5 w-5" />{tx('Report Filters', 'Filter Laporan')}</div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="dui-fieldset">
              <span className="dui-fieldset-legend">{tx('Start date', 'Tanggal mulai')}</span>
              <input type="date" className="dui-input w-full" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="dui-fieldset">
              <span className="dui-fieldset-legend">{tx('End date', 'Tanggal akhir')}</span>
              <input type="date" className="dui-input w-full" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="dui-fieldset md:col-span-1">
              <span className="dui-fieldset-legend">{tx('Agent', 'Agen')}</span>
              <select className="dui-select w-full" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)}>
                <option value="">{tx('All agents', 'Semua agen')}</option>
                {agents.map((agent) => <option key={agent.email} value={agent.email}>{agent.agent_name || agent.email}</option>)}
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
            <Users className="h-5 w-5" /> {tx('Agent Performance', 'Kinerja Agen')}
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><span className="dui-loading dui-loading-spinner dui-loading-lg" /></div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-base-content/60">{tx('No report data for this period.', 'Tidak ada data laporan untuk periode ini.')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="dui-table dui-table-zebra min-w-[1250px] text-xs sm:text-sm">
                <thead>
                  <tr>
                    <th>{tx('Agent', 'Agen')}</th>
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
                  {rows.map((row) => (
                    <tr key={row.agent_email}>
                      <td><div className="font-bold">{row.agent_name || '—'}</div><div className="text-[11px] text-base-content/50">{row.agent_email}</div></td>
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
                  ))}
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
