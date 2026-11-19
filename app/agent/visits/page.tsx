'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, CheckCircle2, MapPin, Route, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import type { Visit } from '@/lib/types'
import { dateTime } from '@/lib/format'
import { CrlRouteIllustration } from '@/components/illustrations/CrlIllustrations'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

const PAGE_SIZE = 5

export default function VisitsPage() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const [rows, setRows] = useState<Visit[]>([])
  const [total, setTotal] = useState(0)
  const [filteredTotal, setFilteredTotal] = useState(0)
  const [completed, setCompleted] = useState(0)
  const [recentDays, setRecentDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      async function load() {
        setLoading(true)
        setError('')
        const s = createClient()
        try {
          // Keep the existing RPC for its summary metrics when it works.
          const { data, error: rpcError } = await s.rpc('crl_agent_history_page_v1', {
            p_kind: 'visits', p_page: page, p_search: search,
          })
          if (!active) return
          if (!rpcError && data) {
            const result = data as { rows: Visit[]; total: number; filteredTotal: number; completed: number; recentDays: number }
            setRows(result.rows ?? [])
            setTotal(result.total ?? 0)
            setFilteredTotal(result.filteredTotal ?? 0)
            setCompleted(result.completed ?? 0)
            setRecentDays(result.recentDays ?? 0)
            return
          }

          // The all-in-one RPC sometimes exceeds the database statement timeout.
          // Fall back to a small, indexed page query rather than blocking the whole UI.
          const { data: { user }, error: authError } = await s.auth.getUser()
          if (authError || !user?.email) throw authError || new Error('Sesi login tidak ditemukan.')
          const email = user.email.trim().toLowerCase()
          const baseColumns = 'visit_id,customer_id,crl_id,visit_date,visit_result,visit_address,visit_summary'
          let query = s.from('visits')
            .select(baseColumns, { count: 'exact' })
            .ilike('agent_email', email)
          const term = search.trim().replace(/[%,()]/g, ' ').slice(0, 80)
          if (term) {
            query = query.or(
              `customer_id.ilike.%${term}%,crl_id.ilike.%${term}%,visit_id.ilike.%${term}%,visit_address.ilike.%${term}%,visit_summary.ilike.%${term}%,visit_result.ilike.%${term}%`
            )
          }
          const { data: pageData, count, error: pageError } = await query
            .order('visit_date', { ascending: false, nullsFirst: false })
            .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
          if (pageError) throw pageError
          if (!active) return
          setRows((pageData || []) as unknown as Visit[])
          setFilteredTotal(count ?? 0)

          // Use an independent count so a search doesn't distort the headline total.
          if (!term) {
            setTotal(count ?? 0)
          } else {
            const { count: overallCount, error: overallError } = await s.from('visits')
              .select('visit_id', { count: 'exact', head: true })
              .ilike('agent_email', email)
            if (!active) return
            if (overallError) throw overallError
            setTotal(overallCount ?? 0)
          }
          // Optional summaries must never block the history list.
          const { count: completedCount } = await s.from('visits')
            .select('visit_id', { count: 'exact', head: true })
            .ilike('agent_email', email)
            .not('visit_result', 'is', null)
            .neq('visit_result', '')
          if (!active) return
          setCompleted(completedCount ?? 0)
          const { data: dates } = await s.from('visits')
            .select('visit_date')
            .ilike('agent_email', email)
            .order('visit_date', { ascending: false })
            .limit(1000)
          if (!active) return
          if (dates) setRecentDays(new Set(dates.map(row => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.visit_date)))).size)
        } catch (err) {
          if (active) setError(err instanceof Error ? err.message : 'Riwayat kunjungan gagal dimuat. Silakan coba lagi.')
        } finally {
          if (active) setLoading(false)
        }
      }
      void load()
    }, search ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [page, search, reloadKey])

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = rows

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
        <article className={`${styles.summaryCard} ${styles.tonePurple}`}><div className={styles.summaryIcon}><Route /></div><strong>{total}</strong><span>{tx('Submitted visits', 'Kunjungan terkirim')}</span></article>
        <article className={`${styles.summaryCard} ${styles.toneGreen}`}><div className={styles.summaryIcon}><CheckCircle2 /></div><strong>{completed}</strong><span>{tx('Completed records', 'Data selesai')}</span></article>
        <article className={`${styles.summaryCard} ${styles.toneBlue}`}><div className={styles.summaryIcon}><CalendarDays /></div><strong>{recentDays}</strong><span>{tx('Active visit days', 'Hari kunjungan aktif')}</span></article>
      </section>

      {!loading && !error && total > 0 && (
        <div className="mb-5">
          <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center text-base-content/60"><Search aria-hidden="true" className="size-5" /></span>
          <input type="search" aria-label={tx('Search visits', 'Cari kunjungan')} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={tx('Search Customer ID, CRL ID, Visit ID, address…', 'Cari ID Pelanggan, ID CRL, ID Kunjungan, alamat…')} className="dui-input dui-input-bordered w-full rounded-xl !pl-12" style={{ paddingLeft: "3rem" }} />
          </div>
          <p className="mt-2 text-sm text-base-content/60">{filteredTotal} {tx('matching visits', 'kunjungan ditemukan')}</p>
        </div>
      )}
      {!loading && !error && total > 0 && filteredTotal === 0 && <div className={styles.state}>{tx('No visits match your search.', 'Tidak ada kunjungan yang cocok dengan pencarian.')}</div>}
      {loading && <div className={styles.state}>{tx('Loading visit history…', 'Memuat riwayat kunjungan…')}</div>}
      {error && <div className={styles.error}><span>{tx('Visit history could not be loaded. Please retry.', 'Riwayat kunjungan gagal dimuat. Silakan coba lagi.')}</span><button type="button" className="dui-btn dui-btn-outline dui-btn-sm" onClick={() => setReloadKey(value => value + 1)}>{tx('Try again', 'Coba lagi')}</button></div>}
      {!loading && !error && total === 0 && <div className={styles.state}><CrlRouteIllustration className="visit-empty-illustration" /><strong>{tx('No visit history yet', 'Belum ada riwayat kunjungan')}</strong><span>{tx('Completed visits will appear here.', 'Kunjungan yang selesai akan tampil di sini.')}</span></div>}

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

      {!loading && !error && filteredTotal > 0 && (
        <nav className={styles.pagination} aria-label="Visit history pagination">
          <p className={styles.paginationInfo}>{tx('Showing', 'Menampilkan')} {start + 1}–{Math.min(start + PAGE_SIZE, filteredTotal)} {tx('of', 'dari')} {filteredTotal}</p>
          <div className={styles.paginationControls}>
            <button type="button" className={styles.navButton} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>{tx('Previous', 'Sebelumnya')}</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, index) => Math.max(1, Math.min(totalPages - 6, safePage - 3)) + index).map((pageNumber) => <button key={pageNumber} type="button" className={`${styles.pageButton} ${pageNumber === safePage ? styles.activePage : ''}`} onClick={() => setPage(pageNumber)} aria-current={pageNumber === safePage ? 'page' : undefined}>{pageNumber}</button>)}
            <button type="button" className={styles.navButton} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>{tx('Next', 'Berikutnya')}</button>
          </div>
        </nav>
      )}
    </main>
  )
}
