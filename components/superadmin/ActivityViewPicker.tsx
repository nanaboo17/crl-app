'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { CalendarDays, Users } from 'lucide-react'

type ViewKind = 'visits' | 'pre-visits'

export default function ActivityViewPicker({ kind, today, locale }: {
  kind: ViewKind
  today: string
  locale: string
}) {
  const [mounted, setMounted] = useState(false)
  const id = locale === 'id'
  const isVisit = kind === 'visits'
  const base = `/superadmin/${kind}`

  useEffect(() => {
    setMounted(true)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center overflow-hidden bg-black/50 backdrop-blur-sm sm:items-center sm:p-6" style={{ width: "100vw", maxWidth: "100vw", left: 0, right: 0 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="activity-view-title"
        className="w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto rounded-t-3xl border border-base-300 bg-base-100 px-4 py-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-8" style={{ maxHeight: "calc(100dvh - 1rem)", boxSizing: "border-box" }}>
        <div className="text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-secondary/15 text-secondary sm:mb-4 sm:size-14">
            <CalendarDays className="size-6 sm:size-7" />
          </div>
          <h2 id="activity-view-title" className="text-lg font-black leading-tight sm:text-2xl">
            {id ? `Pilih Tampilan ${isVisit ? 'Kunjungan' : 'Pra-Kunjungan'}` : `Choose ${isVisit ? 'Visit' : 'Pre-Visit'} View`}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-base-content/65 sm:text-sm">
            {id ? 'Lihat aktivitas berdasarkan rentang tanggal atau berdasarkan agen.' : 'Review activity by date range or by agent.'}
          </p>
        </div>
        <div className="mt-4 grid min-w-0 gap-3 sm:mt-6 sm:grid-cols-2">
          <Link href={`${base}/date?start=${today}&end=${today}`}
            className="group min-w-0 rounded-xl border border-base-300 bg-base-100 p-4 transition hover:border-primary hover:bg-primary/5 sm:rounded-2xl sm:p-5">
            <CalendarDays className="mb-2 size-5 text-primary sm:mb-3 sm:size-6" />
            <div className="text-sm font-black sm:text-base">{id ? 'Lihat per Rentang Tanggal' : 'View by Date Range'}</div>
            <p className="mt-1 text-xs leading-5 text-base-content/65">
              {id ? 'Pilih tanggal mulai dan akhir, lihat data lengkap, dan unduh laporan CSV.' : 'Choose a date range, see full records and export a filtered CSV.'}
            </p>
          </Link>
          <Link href={`${base}?mode=agent&filter=all&page=1`}
            className="group min-w-0 rounded-xl border border-base-300 bg-base-100 p-4 transition hover:border-secondary hover:bg-secondary/5 sm:rounded-2xl sm:p-5">
            <Users className="mb-2 size-5 text-secondary sm:mb-3 sm:size-6" />
            <div className="text-sm font-black sm:text-base">{id ? 'Lihat per Agen' : 'View by Agent'}</div>
            <p className="mt-1 text-xs leading-5 text-base-content/65">
              {id ? 'Pantau aktivitas agen, gunakan filter, dan buka detail catatan.' : 'Monitor agent activity, filter results and open record details.'}
            </p>
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )
}
