'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
  const [records, setRecords] = useState<PreVisit[]>([])
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
      else setRecords((data || []) as PreVisit[])
      setLoading(false)
    })()
  }, [])

  const rows = useMemo(() => {
    const latestByCustomer = new Map<string, PreVisit>()
    for (const record of records) {
      if (!latestByCustomer.has(record.customer_id)) latestByCustomer.set(record.customer_id, record)
    }
    return Array.from(latestByCustomer.values())
  }, [records])

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
          <h1>{tx('One customer, one latest Pre-Visit.', 'Satu pelanggan, satu Pra-Kunjungan terbaru.')}</h1>
          <p>{tx('Each customer is shown once. If a customer has multiple Pre-Visit submissions, only the latest record is displayed here.', 'Setiap pelanggan hanya ditampilkan satu kali. Jika pelanggan memiliki beberapa Pra-Kunjungan, hanya catatan terbaru yang ditampilkan di sini.')}</p>
        </div>
        <div className={styles.heroScene} aria-hidden="true"><PhoneCall /><span className={styles.bubbleOne} /><span className={styles.bubbleTwo} /></div>
      </section>

      <section className={styles.summaryGrid}>
        <article className={`${styles.summaryCard} ${styles.tonePurple}`}><div className={styles.summaryIcon}><ClipboardList /></div><strong>{rows.length}</strong><span>{tx('Customers with pre-visit', 'Pelanggan dengan pra-kunjungan')}</span></article>
        <article className={`${styles.summaryCard} ${styles.toneGreen}`}><div className={styles.summaryIcon}><CheckCircle2 /></div><strong>{ready}</strong><span>{tx('Ready for visit', 'Siap dikunjungi')}</span></article>
        <article className={`${styles.summaryCard} ${styles.toneYellow}`}><div className={styles.summaryIcon}><Clock3 /></div><strong>{followUp}</strong><span>{tx('Need follow-up', 'Perlu tindak lanjut')}</span></article>
      </section>

      {loading && <Loading />}
      {error && <div className={styles.errorCard}>{error}</div>}
      {!loading && !error && rows.length === 0 && <EmptyState title={t('agent.preVisits.emptyTitle')} body={t('agent.preVisits.emptyBody')} illustration={<CrlFollowUpIllustration className="crl-illustration crl-illustration-md" />} />}

      <section className={styles.historyCard}>
        <div className={styles.sectionHead}><div><span>{tx('LATEST PER CUSTOMER', 'TERBARU PER PELANGGAN')}</span><h2>{tx('Pre-Visit customers', 'Pelanggan Pra-Kunjungan')}</h2></div><p>{rows.length} {tx('customers', 'pelanggan')}</p></div>
        <div className={styles.listStack}>
          {pageRows.map((r) => (
            <Link className={styles.card} href={`/agent/pre-visits/${encodeURIComponent(r.previsit_id)}`} key={r.customer_id}>
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
