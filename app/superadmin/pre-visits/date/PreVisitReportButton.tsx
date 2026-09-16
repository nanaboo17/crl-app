'use client'

import { Download } from 'lucide-react'

type Props = {
  date: string
  columns: string[]
  rows: Record<string, unknown>[]
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export default function PreVisitReportButton({ date, columns, rows }: Props) {
  const download = () => {
    const header = columns.map(csvCell).join(',')
    const body = rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${header}\n${body}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pre-visits-${date}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return <button type="button" className="dui-btn dui-btn-primary" onClick={download}><Download className="size-4" />Generate Report</button>
}
