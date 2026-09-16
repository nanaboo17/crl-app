'use client'

import { useMemo, useState } from 'react'
import { Download, Filter, RotateCcw, Search, X } from 'lucide-react'

type Row = Record<string, unknown>

type Props = {
  columns: string[]
  rows: Row[]
  fileName: string
  title: string
  emptyLabel?: string
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function filterValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '(blank)'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export default function FilterableDataTable({ columns, rows, fileName, title, emptyLabel = 'No rows match the selected filters.' }: Props) {
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openColumn, setOpenColumn] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const uniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const column of columns) {
      map[column] = Array.from(new Set(rows.map((row) => filterValue(row[column])))).sort((a, b) => a.localeCompare(b))
    }
    return map
  }, [columns, rows])

  const filteredRows = useMemo(() => rows.filter((row) => columns.every((column) => {
    const selected = filters[column]
    if (!selected || selected.length === 0) return true
    return selected.includes(filterValue(row[column]))
  })), [columns, filters, rows])

  const activeCount = Object.values(filters).filter((values) => values?.length).length

  function toggleValue(column: string, value: string) {
    setFilters((current) => {
      const existing = current[column] ?? []
      const next = existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value]
      return { ...current, [column]: next }
    })
  }

  function clearColumn(column: string) {
    setFilters((current) => ({ ...current, [column]: [] }))
  }

  function selectAllVisible(column: string, values: string[]) {
    setFilters((current) => ({ ...current, [column]: values }))
  }

  function resetAll() {
    setFilters({})
    setSearch('')
    setOpenColumn(null)
  }

  function downloadFiltered() {
    const header = columns.map(csvValue).join(',')
    const body = filteredRows.map((row) => columns.map((column) => csvValue(row[column])).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-base-300 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-black">{title}</h2>
          <p className="text-sm text-base-content/60">Excel-style filters are available on every column. {filteredRows.length} of {rows.length} rows shown.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeCount > 0 && <button type="button" onClick={resetAll} className="dui-btn dui-btn-ghost dui-btn-sm"><RotateCcw className="size-4" />Clear {activeCount} filter{activeCount === 1 ? '' : 's'}</button>}
          <button type="button" onClick={downloadFiltered} disabled={filteredRows.length === 0} className="dui-btn dui-btn-primary dui-btn-sm"><Download className="size-4" />Generate Report</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="dui-table dui-table-zebra min-w-max">
          <thead>
            <tr>
              {columns.map((column) => {
                const selected = filters[column] ?? []
                const isOpen = openColumn === column
                const visibleValues = (uniqueValues[column] ?? []).filter((value) => value.toLowerCase().includes(search.toLowerCase()))
                return (
                  <th key={column} className="relative min-w-[11rem] align-top">
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span>{column}</span>
                      <button
                        type="button"
                        onClick={() => { setOpenColumn(isOpen ? null : column); setSearch('') }}
                        className={`dui-btn dui-btn-ghost dui-btn-xs ${selected.length ? 'text-primary' : ''}`}
                        aria-label={`Filter ${column}`}
                      >
                        <Filter className="size-3.5" />
                        {selected.length > 0 && <span className="text-[10px]">{selected.length}</span>}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="absolute left-2 top-[calc(100%-0.25rem)] z-50 w-72 rounded-xl border border-base-300 bg-base-100 p-3 text-left normal-case tracking-normal shadow-2xl">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <strong className="text-xs">Filter {column}</strong>
                          <button type="button" onClick={() => setOpenColumn(null)} className="dui-btn dui-btn-ghost dui-btn-xs"><X className="size-3.5" /></button>
                        </div>
                        <label className="dui-input dui-input-bordered dui-input-sm flex items-center gap-2">
                          <Search className="size-3.5 opacity-60" />
                          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search values" className="grow text-xs" />
                        </label>
                        <div className="my-2 flex gap-2">
                          <button type="button" onClick={() => selectAllVisible(column, visibleValues)} className="dui-btn dui-btn-ghost dui-btn-xs">Select visible</button>
                          <button type="button" onClick={() => clearColumn(column)} className="dui-btn dui-btn-ghost dui-btn-xs">Clear</button>
                        </div>
                        <div className="max-h-64 overflow-auto rounded-lg border border-base-300">
                          {visibleValues.map((value) => (
                            <label key={value} className="flex cursor-pointer items-start gap-2 border-b border-base-200 px-2 py-2 text-xs last:border-b-0 hover:bg-base-200/50">
                              <input type="checkbox" className="dui-checkbox dui-checkbox-xs mt-0.5" checked={selected.includes(value)} onChange={() => toggleValue(column, value)} />
                              <span className="break-all">{value}</span>
                            </label>
                          ))}
                          {visibleValues.length === 0 && <div className="p-3 text-xs text-base-content/50">No matching values</div>}
                        </div>
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={columns.length} className="py-10 text-center text-sm text-base-content/50">{emptyLabel}</td></tr>
            ) : filteredRows.map((row, index) => (
              <tr key={String(row.visit_id ?? row.previsit_id ?? index)}>
                {columns.map((column) => <td key={column} className="max-w-[22rem] whitespace-pre-wrap break-words align-top text-xs">{displayValue(row[column])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
