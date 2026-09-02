'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import type { PreVisit } from '@/lib/types'
import { dateTime } from '@/lib/format'
import AgentNav from '@/components/AgentNav'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import EmptyState from '@/components/EmptyState'
import StatusPill from '@/components/StatusPill'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

const PAGE_SIZE = 5

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
      const { data, error } = await s.from('pre_visits').select('*').order('created_at', { ascending: false })
      if (error) setError(error.message)
      else setRows((data || []) as PreVisit[])
      setLoading(false)
    })()
  }, [])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = rows.slice(start, start + PAGE_SIZE)

  return (
    <main className={styles.page}>
      <PageTop title={t('agent.preVisits.title')} />
      {loading && <Loading />}
      {error && <div className={styles.errorCard}>{error}</div>}
      {!loading && !error && rows.length === 0 && <EmptyState title={t('agent.preVisits.emptyTitle')} body={t('agent.preVisits.emptyBody')} />}

      <div className={styles.listStack}>
        {pageRows.map((r) => (
          <Link className={styles.card} href={`/agent/pre-visits/${encodeURIComponent(r.previsit_id)}`} key={r.previsit_id}>
            <div className={styles.cardRow}>
              <div>
                <strong>{r.customer_id}</strong>
                <div className={styles.meta}>{r.previsit_id}</div>
              </div>
              <StatusPill>{r.previsit_status}</StatusPill>
            </div>
            <div className={styles.meta}>{t('agent.preVisits.appointment', { date: dateTime(r.appointment_date) })}</div>
          </Link>
        ))}
      </div>

      {!loading && !error && rows.length > 0 && (
        <nav className={styles.pagination} aria-label="Pre-visit pagination">
          <p className={styles.paginationInfo}>
            {tx('Showing', 'Menampilkan')} {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} {tx('of', 'dari')} {rows.length}
          </p>
          <div className={styles.paginationControls}>
            <button type="button" className={styles.navButton} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>
              {tx('Previous', 'Sebelumnya')}
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button key={pageNumber} type="button" className={`${styles.pageButton} ${pageNumber === safePage ? styles.activePage : ''}`} onClick={() => setPage(pageNumber)} aria-current={pageNumber === safePage ? 'page' : undefined}>
                {pageNumber}
              </button>
            ))}
            <button type="button" className={styles.navButton} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>
              {tx('Next', 'Berikutnya')}
            </button>
          </div>
        </nav>
      )}
      <AgentNav />
    </main>
  )
}
