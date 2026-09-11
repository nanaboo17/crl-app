'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardList, Clock3, PhoneCall } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    ;(async () => {
      const s = createClient()
      const { data, error } = await s
        .from('pre_visits')
        .select('*')
        .order('created_at', { ascending: false })
        .order('previsit_id', { ascending: false })
      if (error) setError(error.message)
      else setRows((data || []) as PreVisit[])
      setLoading(false)
    })()
  }, [])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = rows.slice(start, start + PAGE_SIZE)
  const ready = rows.filter((r) => r.previsit_status === 'Ready for Visit').length
  const followUp = rows.filter((r) => r.previsit_status === 'Need Follow-up').length

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{tx('PRE-VISIT HISTORY', 'RIWAYAT PRA-KUNJUNGAN')}</span>
          <h1>{tx('Every submission is shown as its own Pre-Visit record.', 'Setiap pengiriman ditampilkan sebagai catatan Pra-Kunjungan tersendiri.')}</h1>
          <p>{tx('A customer can appear more than once when multiple Pre-Visits have been submitted. Each card is identified by its Pre-Visit ID.', 'Satu pelanggan dapat muncul lebih dari sekali jika memiliki beberapa Pra-Kunjungan. Setiap kartu dibedakan berdasarkan ID Pra-Kunjungan.')}</p>
        </div>
        <div className={styles.heroScene} aria-hidden="true"><PhoneCall /><span className={styles.bubbleOne} /><span className={styles.bubbleTwo} /></div>
      </section>

      <section className={styles.summaryGrid}>
        <article className={`${styles.summaryCard} ${styles.tonePurple}`}><div className={styles.summaryIcon}><ClipboardList /></div><strong>{rows.length}</strong><span>{tx('Total pre-visit records', 'Total catatan pra-kunjungan')}</span></article>
        <article className={`${styles.summaryCard} ${styles.toneGreen}`}><div className={styles.summaryIcon}><CheckCircle2 /></div><strong>{ready}</strong><span>{tx('Ready for visit', 'Siap dikunjungi')}</span></article>
        <article className={`${styles.summaryCard} ${styles.toneYellow}`}><div className={styles.summaryIcon}><Clock3 /></div><strong>{followUp}</strong><span>{tx('Need follow-up', 'Perlu tindak lanjut')}</span></article>
      </section>

      {loading && <Loading />}
      {error && <div className={styles.errorCard}>{error}</div>}
      {!loading && !error && rows.length === 0 && <EmptyState title={t('agent.preVisits.emptyTitle')} body={t('agent.preVisits.emptyBody')} illustration={<CrlFollowUpIllustration className="crl-illustration crl-illustration-md" />} />}

      <section className={styles.historyCard}>
        <div className={styles.sectionHead}><div><span>{tx('SUBMITTED RECORDS', 'DATA TERKIRIM')}</span><h2>{tx('Pre-Visit ID records', 'Catatan berdasarkan ID Pra-Kunjungan')}</h2></div><p>{rows.length} {tx('records', 'data')}</p></div>
        <div className={styles.listStack}>
          {pageRows.map((r) => (
            <Link className={styles.card} href={`/agent/pre-visits/${encodeURIComponent(r.previsit_id)}`} key={r.previsit_id}>
              <div className={styles.cardRow}>
                <div>
                  <span className={styles.previsitId}>{tx('Pre-Visit ID', 'ID Pra-Kunjungan')}</span>
                  <strong>{r.previsit_id}</strong>
                </div>
                <StatusPill>{r.previsit_status}</StatusPill>
              </div>
              <div className={styles.meta}>{tx('Customer ID', 'ID Pelanggan')}: {r.customer_id}</div>
              <div className={styles.meta}>{tx('Submitted', 'Dikirim')}: {wibDateTime(r.created_at, locale)}</div>
              <div className={styles.meta}>{t('agent.preVisits.appointment', { date: dateTime(r.appointment_date) })}</div>
              <div className={styles.openRow}><span>{tx('View this Pre-Visit record', 'Lihat catatan Pra-Kunjungan ini')}</span><span>›</span></div>
            </Link>
          ))}
        </div>
      </section>

      {!loading && !error && rows.length > 0 && (
        <nav className={styles.pagination} aria-label="Pre-visit pagination">
          <p className={styles.paginationInfo}>{tx('Showing', 'Menampilkan')} {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} {tx('of', 'dari')} {rows.length}</p>
          <div className={styles.paginationControls}>
            <button type="button" className={styles.navButton} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>{tx('Previous', 'Sebelumnya')}</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" className={`${styles.pageButton} ${pageNumber === safePage ? styles.activePage : ''}`} onClick={() => setPage(pageNumber)} aria-current={pageNumber === safePage ? 'page' : undefined}>{pageNumber}</button>)}
            <button type="button" className={styles.navButton} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>{tx('Next', 'Berikutnya')}</button>
          </div>
        </nav>
      )}
      <AgentNav />
    </main>
  )
}
