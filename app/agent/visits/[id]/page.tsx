'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CalendarClock, CheckCircle2, Image as ImageIcon, MapPin, Navigation, NotebookText, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import type { Visit, Customer } from '@/lib/types'
import { dateTime } from '@/lib/format'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

export default function VisitDetailPage() {
  const { t, locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const params = useParams<{ id: string }>()
  const id = decodeURIComponent(params.id)
  const [row, setRow] = useState<Visit | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const s = createClient()
      const { data, error } = await s.from('visits').select('*').eq('visit_id', id).single()
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setRow(data as Visit)
      const { data: c } = await s.from('customers').select('*').eq('customer_id', data.customer_id).single()
      setCustomer((c || null) as Customer | null)

      if (data.visit_photo_url) {
        const { data: signed } = await s.storage.from('visit-evidence').createSignedUrl(data.visit_photo_url, 3600)
        setPhotoUrl(signed?.signedUrl || '')
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return <main className={styles.page}><PageTop title={t('agent.visitDetail.title')} back /><div className={styles.loading}><Loading /></div></main>
  }

  if (error || !row) {
    return <main className={styles.page}><PageTop title={t('agent.visitDetail.title')} back /><div className={styles.errorCard}>{error || t('agent.visitDetail.notFound')}</div></main>
  }

  const hasLocation = row.latitude !== null && row.longitude !== null
  const locationLabel = hasLocation ? `${row.latitude?.toFixed(6)}, ${row.longitude?.toFixed(6)}` : '—'

  return (
    <main className={styles.page}>
      <PageTop title={t('agent.visitDetail.titleDetail')} back />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{tx('VISIT RECORD', 'CATATAN KUNJUNGAN')}</span>
          <h1>{customer?.customer_name || row.customer_id}</h1>
          <p>{row.visit_id} · {row.customer_id}</p>
        </div>
        <span className={styles.status}>{row.visit_result || t('agent.visitDetail.submitted')}</span>
      </section>

      <section className={styles.summaryGrid}>
        <article className={`${styles.summaryCard} ${styles.tonePurple}`}><CalendarClock /><div><span>{t('agent.visitDetail.visitTime')}</span><strong>{dateTime(row.visit_date)}</strong></div></article>
        <article className={`${styles.summaryCard} ${styles.toneGreen}`}><ShieldCheck /><div><span>{t('agent.visitDetail.consent')}</span><strong>{row.consent_given ? t('agent.visitDetail.yes') : t('agent.visitDetail.no')}</strong></div></article>
        <article className={`${styles.summaryCard} ${styles.toneBlue}`}><MapPin /><div><span>{tx('GPS location', 'Lokasi GPS')}</span><strong>{locationLabel}</strong></div></article>
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.card}>
          <div className={styles.cardTitle}><MapPin /><div><span>{tx('LOCATION', 'LOKASI')}</span><h2>{t('agent.visitDetail.address')}</h2></div></div>
          <p className={styles.bodyText}>{row.visit_address || '—'}</p>
          <div className={styles.coordinateGrid}>
            <div><span>{t('agent.visitDetail.latitude')}</span><strong>{row.latitude?.toFixed(6) || '—'}</strong></div>
            <div><span>{t('agent.visitDetail.longitude')}</span><strong>{row.longitude?.toFixed(6) || '—'}</strong></div>
            <div><span>{tx('GPS accuracy', 'Akurasi GPS')}</span><strong>{row.gps_accuracy != null ? `${Number(row.gps_accuracy).toFixed(1)} m` : '—'}</strong></div>
            <div><span>{tx('Captured at', 'Diambil pada')}</span><strong>{row.gps_captured_at ? dateTime(row.gps_captured_at) : '—'}</strong></div>
          </div>
          {hasLocation && <a className={styles.mapButton} target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}><Navigation />{t('agent.visitDetail.openLocation')}</a>}
        </article>

        <article className={styles.card}>
          <div className={styles.cardTitle}><NotebookText /><div><span>{tx('OUTCOME', 'HASIL')}</span><h2>{t('agent.visitDetail.summary')}</h2></div></div>
          <p className={styles.bodyText}>{row.visit_summary || '—'}</p>
          <div className={styles.resultBox}>
            <span>{tx('Visit result', 'Hasil kunjungan')}</span>
            <strong>{row.visit_result || t('agent.visitDetail.submitted')}</strong>
          </div>
        </article>
      </section>

      <section className={styles.photoCard}>
        <div className={styles.cardTitle}><ImageIcon /><div><span>{tx('EVIDENCE', 'BUKTI')}</span><h2>{tx('Visit evidence photo', 'Foto bukti kunjungan')}</h2></div></div>
        {photoUrl ? <img src={photoUrl} alt={t('agent.visitDetail.evidenceAlt')} className={styles.photo} /> : <div className={styles.noPhoto}><ImageIcon /><strong>{tx('No evidence photo', 'Tidak ada foto bukti')}</strong><span>{tx('No photo was attached to this visit record.', 'Tidak ada foto yang dilampirkan pada catatan kunjungan ini.')}</span></div>}
      </section>

      <section className={styles.doneCard}><CheckCircle2 /><div><strong>{tx('Visit record saved', 'Catatan kunjungan tersimpan')}</strong><span>{tx('This submitted record is available in your visit history.', 'Catatan yang dikirim ini tersedia di riwayat kunjungan Anda.')}</span></div></section>
    </main>
  )
}
