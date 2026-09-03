'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, CheckCircle2, History, MapPin, Route } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import type { Visit } from '@/lib/types'
import { dateTime } from '@/lib/format'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

const PAGE_SIZE = 5

export default function VisitsPage() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const [rows, setRows] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    ;(async () => {
      const s = createClient()
      const { data, error } = await s.from('visits').select('*').order('visit_date', { ascending: false })
      if (error) setError(error.message)
      else setRows((data || []) as Visit[])
      setLoading(false)
    })()
  }, [])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = rows.slice(start, start + PAGE_SIZE)

  const grouped = useMemo(() => {
    const map = new Map<string, Visit[]>()
    pageRows.forEach((row) => {
      const day = row.visit_date
        ? new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'long' }).format(new Date(row.visit_date))
        : tx('Unknown date', 'Tanggal tidak diketahui')
      map.set(day, [...(map.get(day) || []), row])
    })
    return [...map.entries()]
  }, [pageRows, locale])

  const completed = rows.filter((row) => Boolean(row.visit_result || row.visit_status_kunjungan)).length
  const recentDays = new Set(rows.filter((row) => row.visit_date).map((row) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(row.visit_date)))).size

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{tx('FIELD HISTORY', 'RIWAYAT LAPANGAN')}</span>
          <h1>{tx('Every completed visit, easy to review.', 'Setiap kunjungan selesai, mudah ditinjau.')}</h1>
          <p>{tx('Check your submitted customer visits, results, notes, and activity by day.', 'Lihat kunjungan pelanggan yang sudah dikirim, hasil, catatan, dan aktivitas per hari.')}</p>
        </div>
        <div className={styles.heroScene} aria-hidden="true">
          <MapPin /><span className={styles.routeLine} /><span className={styles.dotOne} /><span className={styles.dotTwo} />
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <article className={`${styles.summaryCard} ${styles.tonePurple}`}><div className={styles.summaryIcon}><Route /></div><strong>{rows.length}</strong><span>{tx('Submitted visits', 'Kunjungan terkirim')}</span></article>
        <article className={`${styles.summaryCard} ${styles.toneGreen}`}><div className={styles.summaryIcon}><CheckCircle2 /></div><strong>{completed}</strong><span>{tx('Completed records', 'Data selesai')}</span></article>
        <article className={`${styles.summaryCard} ${styles.toneBlue}`}><div className={styles.summaryIcon}><CalendarDays /></div><strong>{recentDays}</strong><span>{tx('Active visit days', 'Hari kunjungan aktif')}</span></article>
      </section>

      {loading && <div className={styles.state}>{tx('Loading visit history…', 'Memuat riwayat kunjungan…')}</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!loading && !error && rows.length === 0 && <div className={styles.state}><History aria-hidden="true" /><strong>{tx('No visit history yet', 'Belum ada riwayat kunjungan')}</strong><span>{tx('Completed visits will appear here.', 'Kunjungan yang selesai akan tampil di sini.')}</span></div>}

      {!loading && !error && grouped.map(([day, visits]) => (
        <section key={day} className={styles.dayGroup}>
          <div className={styles.dayTitle}><CalendarDays aria-hidden="true" /><h2>{day}</h2><span>{visits.length}</span></div>
          <div className={styles.list}>
            {visits.map((visit) => (
              <Link href={`/agent/visits/${encodeURIComponent(visit.visit_id)}`} key={visit.visit_id} className={styles.visitCard}>
                <div className={styles.visitMain}><div><strong>{visit.customer_id}</strong><span>{visit.visit_id}</span></div><span className={styles.result}>{visit.visit_result || tx('Submitted', 'Terkirim')}</span></div>
                <div className={styles.meta}><span>{dateTime(visit.visit_date)}</span>{visit.visit_address && <span>{visit.visit_address}</span>}</div>
                {visit.visit_summary && <p className={styles.summaryText}>{visit.visit_summary}</p>}
                <div className={styles.openRow}><span>{tx('View visit details', 'Lihat detail kunjungan')}</span><ChevronRight aria-hidden="true" /></div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {!loading && !error && rows.length > 0 && (
        <nav className={styles.pagination} aria-label="Visit history pagination">
          <p className={styles.paginationInfo}>{tx('Showing', 'Menampilkan')} {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} {tx('of', 'dari')} {rows.length}</p>
          <div className={styles.paginationControls}>
            <button type="button" className={styles.navButton} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>{tx('Previous', 'Sebelumnya')}</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" className={`${styles.pageButton} ${pageNumber === safePage ? styles.activePage : ''}`} onClick={() => setPage(pageNumber)} aria-current={pageNumber === safePage ? 'page' : undefined}>{pageNumber}</button>)}
            <button type="button" className={styles.navButton} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>{tx('Next', 'Berikutnya')}</button>
          </div>
        </nav>
      )}
    </main>
  )
}
