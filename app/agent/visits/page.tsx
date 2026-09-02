'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, History, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import type { Visit } from '@/lib/types'
import { dateTime } from '@/lib/format'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

export default function VisitsPage() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const [rows, setRows] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const s = createClient()
      const { data, error } = await s
        .from('visits')
        .select('*')
        .order('visit_date', { ascending: false })

      if (error) setError(error.message)
      else setRows((data || []) as Visit[])
      setLoading(false)
    })()
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, Visit[]>()
    rows.forEach((row) => {
      const day = row.visit_date
        ? new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', {
            dateStyle: 'long',
          }).format(new Date(row.visit_date))
        : tx('Unknown date', 'Tanggal tidak diketahui')
      map.set(day, [...(map.get(day) || []), row])
    })
    return [...map.entries()]
  }, [rows, locale])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.iconWrap}><History aria-hidden="true" /></div>
        <div>
          <p className={styles.eyebrow}>{tx('Field activity', 'Aktivitas lapangan')}</p>
          <h1>{tx('Visit History', 'Riwayat Kunjungan')}</h1>
          <p>{tx('Review all of your submitted customer visits.', 'Lihat seluruh kunjungan pelanggan yang sudah Anda kirim.')}</p>
        </div>
      </header>

      <section className={styles.summary}>
        <MapPin aria-hidden="true" />
        <div>
          <span>{tx('Total submitted visits', 'Total kunjungan terkirim')}</span>
          <strong>{rows.length}</strong>
        </div>
      </section>

      {loading && <div className={styles.state}>{tx('Loading visit history…', 'Memuat riwayat kunjungan…')}</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className={styles.state}>
          <History aria-hidden="true" />
          <strong>{tx('No visit history yet', 'Belum ada riwayat kunjungan')}</strong>
          <span>{tx('Completed visits will appear here.', 'Kunjungan yang selesai akan tampil di sini.')}</span>
        </div>
      )}

      {!loading && !error && grouped.map(([day, visits]) => (
        <section key={day} className={styles.dayGroup}>
          <div className={styles.dayTitle}>
            <CalendarDays aria-hidden="true" />
            <h2>{day}</h2>
            <span>{visits.length}</span>
          </div>

          <div className={styles.list}>
            {visits.map((visit) => (
              <Link
                href={`/agent/visits/${encodeURIComponent(visit.visit_id)}`}
                key={visit.visit_id}
                className={styles.visitCard}
              >
                <div className={styles.visitMain}>
                  <div>
                    <strong>{visit.customer_id}</strong>
                    <span>{visit.visit_id}</span>
                  </div>
                  <span className={styles.result}>{visit.visit_result || tx('Submitted', 'Terkirim')}</span>
                </div>

                <div className={styles.meta}>
                  <span>{dateTime(visit.visit_date)}</span>
                  {visit.visit_address && <span>{visit.visit_address}</span>}
                </div>

                {visit.visit_summary && (
                  <p className={styles.summaryText}>{visit.visit_summary}</p>
                )}

                <div className={styles.openRow}>
                  <span>{tx('View visit details', 'Lihat detail kunjungan')}</span>
                  <ChevronRight aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
