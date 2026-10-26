'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Users } from 'lucide-react'

export type WeeklyAgentActivityRow = {
  agent_email: string
  agent_name: string | null
  week_start: string
  week_end: string
  pre_visits: number
  visits: number
  visit_conversion: number
}

type Props = {
  rows: WeeklyAgentActivityRow[]
  loading: boolean
  locale: 'en' | 'id'
  startDate: string
  endDate: string
}

const PAGE_SIZE = 10

export default function WeeklyAgentActivity({ rows, loading, locale, startDate, endDate }: Props) {
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const displayRange = (start: string, end: string) => `${start < startDate ? startDate : start} — ${end > endDate ? endDate : end}`
  const [week, setWeek] = useState('')
  const [page, setPage] = useState(1)

  const weekOptions = useMemo(() => {
    const map = new Map<string, { week_start: string; week_end: string }>()
    for (const row of rows) {
      if (!map.has(row.week_start)) {
        map.set(row.week_start, { week_start: row.week_start, week_end: row.week_end })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.week_start.localeCompare(a.week_start))
  }, [rows])

  const filteredRows = useMemo(
    () => (week ? rows.filter((row) => row.week_start === week) : rows),
    [rows, week]
  )

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [week, rows])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const weeklyTotals = useMemo(() => {
    const map = new Map<string, { week_start: string; week_end: string; pre_visits: number; visits: number }>()
    for (const row of rows) {
      const current = map.get(row.week_start) ?? {
        week_start: row.week_start,
        week_end: row.week_end,
        pre_visits: 0,
        visits: 0,
      }
      current.pre_visits += Number(row.pre_visits || 0)
      current.visits += Number(row.visits || 0)
      map.set(row.week_start, current)
    }
    return Array.from(map.values()).sort((a, b) => a.week_start.localeCompare(b.week_start))
  }, [rows])

  const chartWeek = week || weekOptions[0]?.week_start || ''
  const topAgentRows = useMemo(
    () => rows
      .filter((row) => row.week_start === chartWeek)
      .sort((a, b) => Number(b.visits || 0) - Number(a.visits || 0))
      .slice(0, 10),
    [chartWeek, rows]
  )

  const weeklyMax = Math.max(
    1,
    ...weeklyTotals.flatMap((item) => [Number(item.pre_visits || 0), Number(item.visits || 0)])
  )
  const agentMax = Math.max(
    1,
    ...topAgentRows.flatMap((item) => [Number(item.pre_visits || 0), Number(item.visits || 0)])
  )

  return (
    <>
      <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-card-body gap-4 p-0 sm:p-0">
          <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-end sm:justify-between sm:px-5 sm:pt-5">
            <div className="flex items-center gap-2 font-bold">
              <Users className="h-5 w-5" />
              {tx('Weekly Activity by Agent', 'Aktivitas Mingguan per Agen')}
            </div>
            <label className="dui-fieldset w-full sm:w-72">
              <span className="dui-fieldset-legend">{tx('Filter week', 'Filter minggu')}</span>
              <select className="dui-select w-full" value={week} onChange={(event) => setWeek(event.target.value)}>
                <option value="">{tx('All weeks', 'Semua minggu')}</option>
                {weekOptions.map((item) => (
                  <option key={item.week_start} value={item.week_start}>
                    {displayRange(item.week_start, item.week_end)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <span className="dui-loading dui-loading-spinner dui-loading-lg" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-base-content/60">
              {tx('No weekly activity for this period.', 'Tidak ada aktivitas mingguan untuk periode ini.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="dui-table dui-table-zebra min-w-[820px] text-xs sm:text-sm">
                <thead>
                  <tr>
                    <th>{tx('Agent', 'Agen')}</th>
                    <th>{tx('Week', 'Minggu')}</th>
                    <th>{tx('Pre-Visits', 'Pra-Kunjungan')}</th>
                    <th>{tx('Visits', 'Kunjungan')}</th>
                    <th>{tx('Visit Conversion', 'Konversi Kunjungan')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={row.agent_email + '-' + row.week_start}>
                      <td>
                        <div className="font-bold">{row.agent_name || '—'}</div>
                        <div className="text-[11px] text-base-content/50">{row.agent_email}</div>
                      </td>
                      <td>{displayRange(row.week_start, row.week_end)}</td>
                      <td>{row.pre_visits}</td>
                      <td>{row.visits}</td>
                      <td>{Number(row.visit_conversion || 0).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredRows.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-base-300 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="text-xs font-semibold text-base-content/60">
                {tx('Showing', 'Menampilkan')} {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} {tx('of', 'dari')} {filteredRows.length}
              </div>
              <div className="dui-join">
                <button type="button" className="dui-btn dui-btn-sm dui-join-item" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  {tx('Previous', 'Sebelumnya')}
                </button>
                <button type="button" className="dui-btn dui-btn-sm dui-join-item pointer-events-none">
                  {safePage} / {totalPages}
                </button>
                <button type="button" className="dui-btn dui-btn-sm dui-join-item" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
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
              <div className="flex items-center gap-2 font-bold">
                <CalendarDays className="h-5 w-5" />
                {tx('Weekly Activity Trend', 'Tren Aktivitas Mingguan')}
              </div>
              <div className="text-xs text-base-content/50">
                {tx('Pre-Visits and Visits by week for the current filters.', 'Pra-Kunjungan dan Kunjungan per minggu sesuai filter saat ini.')}
              </div>
            </div>
            <div className="space-y-4">
              {weeklyTotals.map((item) => (
                <div key={item.week_start} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold">{displayRange(item.week_start, item.week_end)}</span>
                    <span className="text-base-content/50">{item.pre_visits} PV · {item.visits} V</span>
                  </div>
                  <div className="grid grid-cols-[76px_1fr] items-center gap-2 text-[11px]">
                    <span>{tx('Pre-Visits', 'Pra-Kunjungan')}</span>
                    <div className="h-3 rounded-full bg-base-200">
                      <div className="h-3 rounded-full bg-primary" style={{ width: String((Number(item.pre_visits || 0) / weeklyMax) * 100) + '%' }} />
                    </div>
                    <span>{tx('Visits', 'Kunjungan')}</span>
                    <div className="h-3 rounded-full bg-base-200">
                      <div className="h-3 rounded-full bg-secondary" style={{ width: String((Number(item.visits || 0) / weeklyMax) * 100) + '%' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dui-card border border-base-300 bg-base-100 shadow-sm">
          <div className="dui-card-body gap-4">
            <div>
              <div className="font-bold">{tx('Top Agent Activity', 'Aktivitas Agen Teratas')}</div>
              <div className="text-xs text-base-content/50">
                {weekOptions.find((item) => item.week_start === chartWeek) ? displayRange(weekOptions.find((item) => item.week_start === chartWeek)!.week_start, weekOptions.find((item) => item.week_start === chartWeek)!.week_end) : chartWeek}
              </div>
            </div>
            <div className="space-y-3">
              {topAgentRows.map((row) => (
                <div key={row.agent_email} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-semibold">{row.agent_name || row.agent_email}</span>
                    <span className="shrink-0 text-base-content/50">{row.pre_visits} PV · {row.visits} V</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="h-2.5 rounded-full bg-base-200">
                      <div className="h-2.5 rounded-full bg-primary" style={{ width: String((Number(row.pre_visits || 0) / agentMax) * 100) + '%' }} />
                    </div>
                    <div className="h-2.5 rounded-full bg-base-200">
                      <div className="h-2.5 rounded-full bg-secondary" style={{ width: String((Number(row.visits || 0) / agentMax) * 100) + '%' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 text-[11px] text-base-content/60">
              <span><span className="mr-1 inline-block size-2 rounded-sm bg-primary" />{tx('Pre-Visits', 'Pra-Kunjungan')}</span>
              <span><span className="mr-1 inline-block size-2 rounded-sm bg-secondary" />{tx('Visits', 'Kunjungan')}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
