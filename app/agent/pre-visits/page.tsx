'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Clock3, PhoneCall, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import type { PreVisit } from '@/lib/types'
import { dateTime } from '@/lib/format'
import AgentNav from '@/components/AgentNav'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import StatusPill from '@/components/StatusPill'
import { CrlFollowUpIllustration } from '@/components/illustrations/CrlIllustrations'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

const PAGE_SIZE = 5
const TIMEZONE = 'Asia/Jakarta'

function wibDateTime(value: string | null | undefined, locale: string) {
  if (!value) return '—'
  return `${new Date(value).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} WIB`
}

export default function PreVisitsPage() {
  const { t, locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const [rows, setRows] = useState<PreVisit[]>([])
  const [total, setTotal] = useState(0)
  const [filteredTotal, setFilteredTotal] = useState(0)
  const [ready, setReady] = useState(0)
  const [followUp, setFollowUp] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      const s = createClient()
      const { data, error } = await s.rpc('crl_agent_history_page_v1', { p_kind: 'pre_visits', p_page: page, p_search: search })
      if (!active) return
      if (error) setError(error.message)
      else {
        const result = data as { rows: PreVisit[]; total: number; filteredTotal: number; ready: number; followup: number }
        setRows(result.rows ?? [])
        setTotal(result.total ?? 0)
        setFilteredTotal(result.filteredTotal ?? 0)
        setReady(result.ready ?? 0)
        setFollowUp(result.followup ?? 0)
      }
      setLoading(false)
    }, search ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [page, search])

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = rows

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{tx('PRE-VISIT HISTORY', 'RIWAYAT PRA-KUNJUNGAN')}</span>
          <h1>{tx('One customer, one latest Pre-Visit.', 'Satu pelanggan, satu Pra-Kunjungan terbaru.')}</h1>
          <p>{tx('Each customer is shown once. If a customer has multiple Pre-Visit submissions, only the latest record is displayed here.', 'Setiap pelanggan hanya ditampilkan satu kali. Jika pelanggan memiliki beberapa Pra-Kunjungan, hanya catatan terbaru yang ditampilkan di sini.')}</p>
        </div>
        <div className={styles.heroScene} aria-hidden="true"><PhoneCall /><span className={styles.bubbleOne} /><span className={styles.bubbleTwo} /></div>
      </section>

      <section className={styles.summaryGrid}>
        <article className={`${styles.summaryCard} ${styles.tonePurple}`}><div className={styles.summaryIcon}><ClipboardList /></div><strong>{total}</strong><span>{tx('Customers with pre-visit', 'Pelanggan dengan pra-kunjungan')}</span></article>
        <article className={`${styles.summaryCard} ${styles.toneGreen}`}><div className={styles.summaryIcon}><CheckCircle2 /></div><strong>{ready}</strong><span>{tx('Ready for visit', 'Siap dikunjungi')}</span></article>
        <article className={`${styles.summaryCard} ${styles.toneYellow}`}><div className={styles.summaryIcon}><Clock3 /></div><strong>{followUp}</strong><span>{tx('Need follow-up', 'Perlu tindak lanjut')}</span></article>
      </section>

      {loading && <Loading />}
      {error && <div className={styles.errorCard}>{error}</div>}
      {!loading && !error && total === 0 && <EmptyState title={t('agent.preVisits.emptyTitle')} body={t('agent.preVisits.emptyBody')} illustration={<CrlFollowUpIllustration className="crl-illustration crl-illustration-md" />} />}

      <section className={styles.historyCard}>
        <div className={styles.sectionHead}><div><span>{tx('LATEST PER CUSTOMER', 'TERBARU PER PELANGGAN')}</span><h2>{tx('Pre-Visit customers', 'Pelanggan Pra-Kunjungan')}</h2></div><p>{total} {tx('customers', 'pelanggan')}</p></div>
        {!loading && !error && total > 0 && (
          <div className="mb-5">
            <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center text-base-content/60"><Search aria-hidden="true" className="size-5" /></span>
            <input type="search" aria-label={tx('Search pre-visits', 'Cari pra-kunjungan')} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder={tx('Search Customer ID, CRL ID, Pre-Visit ID, status…', 'Cari ID Pelanggan, ID CRL, ID Pra-Kunjungan, status…')} className="dui-input dui-input-bordered w-full rounded-xl !pl-12" style={{ paddingLeft: "3rem" }} />
          </div>
            <p className="mt-2 text-sm text-base-content/60">{filteredTotal} {tx('matching customers', 'pelanggan ditemukan')}</p>
          </div>
        )}
        {!loading && !error && total > 0 && filteredTotal === 0 && <p className="py-8 text-center text-base-content/60">{tx('No pre-visits match your search.', 'Tidak ada pra-kunjungan yang cocok dengan pencarian.')}</p>}
        <div className={styles.listStack}>
          {pageRows.map((r) => (
            <Link className={styles.card} href={`/agent/pre-visits/${encodeURIComponent(r.previsit_id)}`} key={r.crl_id || r.previsit_id}>
              <div className={styles.cardRow}>
                <div>
                  <span className={styles.previsitId}>{tx('Customer ID', 'ID Pelanggan')}</span>
                  <strong>{r.customer_id}</strong>
                </div>
                <StatusPill>{r.previsit_status}</StatusPill>
              </div>
              <div className={styles.meta}>{tx('Latest Pre-Visit ID', 'ID Pra-Kunjungan terbaru')}: {r.previsit_id}</div>
              <div className={styles.meta}>{tx('Submitted', 'Dikirim')}: {wibDateTime(r.created_at, locale)}</div>
              <div className={styles.meta}>{t('agent.preVisits.appointment', { date: dateTime(r.appointment_date) })}</div>
              <div className={styles.openRow}><span>{tx('View latest Pre-Visit', 'Lihat Pra-Kunjungan terbaru')}</span><span>›</span></div>
            </Link>
          ))}
        </div>
      </section>

      {!loading && !error && filteredTotal > 0 && (
        <nav className={styles.pagination} aria-label="Pre-visit pagination">
          <p className={styles.paginationInfo}>{tx('Showing', 'Menampilkan')} {start + 1}–{Math.min(start + PAGE_SIZE, filteredTotal)} {tx('of', 'dari')} {filteredTotal}</p>
          <div className={styles.paginationControls}>
            <button type="button" className={styles.navButton} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>{tx('Previous', 'Sebelumnya')}</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, index) => Math.max(1, Math.min(totalPages - 6, safePage - 3)) + index).map((pageNumber) => <button key={pageNumber} type="button" className={`${styles.pageButton} ${pageNumber === safePage ? styles.activePage : ''}`} onClick={() => setPage(pageNumber)} aria-current={pageNumber === safePage ? 'page' : undefined}>{pageNumber}</button>)}
            <button type="button" className={styles.navButton} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>{tx('Next', 'Berikutnya')}</button>
          </div>
        </nav>
      )}
      <AgentNav />
    </main>
  )
}
