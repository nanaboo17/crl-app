'use client'

import { Download } from 'lucide-react'

type Row = Record<string, unknown>

function csvValue(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export default function VisitReportButton({ date, columns, rows }: { date: string; columns: string[]; rows: Row[] }) {
  function download() {
    const header = columns.map(csvValue).join(',')
    const body = rows.map((row) => columns.map((column) => csvValue(row[column])).join(',')).join('\n')
    const csv = `\uFEFF${header}\n${body}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `visit-report-${date}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" onClick={download} disabled={rows.length === 0} className="dui-btn dui-btn-primary gap-2">
      <Download className="size-4" aria-hidden="true" />
      Generate Report
    </button>
  )
}
