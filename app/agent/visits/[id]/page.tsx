'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { retentionOffersForCustomer, NO_APPROVED_OFFER } from '@/lib/retention-offers'
import { CalendarClock, CheckCircle2, Gauge, Image as ImageIcon, MapPin, Navigation, NotebookText, Pencil, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import type { Visit, Customer } from '@/lib/types'
import { dateTime } from '@/lib/format'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

function formatMbps(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Mbps`
}

export default function VisitDetailPage() {
  const { t, locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const params = useParams<{ id: string }>()
  const id = decodeURIComponent(params.id)
  const [row, setRow] = useState<Visit | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [optionalPhotoUrls, setOptionalPhotoUrls] = useState<{
    payment: string
    speedTest: string
    other: string
  }>({ payment: '', speedTest: '', other: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editOptions, setEditOptions] = useState({ visit_status_kunjungan: '', conversation_result: '', approved_offer: '', unpaid_reason: '', planned_payment_date: '' })
  function startEdit() {
    if (!row) return
    const record = row as Visit & { visit_status_kunjungan?: string | null; conversation_result?: string | null; approved_offer?: string | null; unpaid_reason?: string | null; planned_payment_date?: string | null }
    setEditOptions({
      visit_status_kunjungan: record.visit_status_kunjungan || '',
      conversation_result: record.conversation_result || '',
      approved_offer: record.approved_offer || '',
      unpaid_reason: record.unpaid_reason || '',
      planned_payment_date: record.planned_payment_date || '',
    })
    setEditError('')
    setEditOpen(true)
  }
  async function saveEdit() {
    if (!row || editSaving) return
    setEditError('')
    if (!editOptions.visit_status_kunjungan || !editOptions.conversation_result) {
      setEditError(tx('Please select visit status and conversation result.', 'Pilih status kunjungan dan hasil percakapan.'))
      return
    }
    const noContact = editOptions.conversation_result === 'Tidak bertemu pelanggan'
    const promiseToPay = editOptions.conversation_result === 'Bersedia bayar / Promise to Pay'
    if (promiseToPay && !editOptions.planned_payment_date) {
      setEditError(tx('Select the planned payment date.', 'Pilih rencana tanggal pembayaran.'))
      return
    }
    const offers = retentionOffersForCustomer(customer?.customer_id || row.customer_id)
    if (!noContact && editOptions.approved_offer && editOptions.approved_offer !== NO_APPROVED_OFFER &&
        !offers.some((offer) => offer.value === editOptions.approved_offer)) {
      setEditError(tx('Invalid offer for this customer.', 'Offer tidak valid untuk pelanggan ini.'))
      return
    }
    setEditSaving(true)
    try {
      const patch = {
        visit_status_kunjungan: editOptions.visit_status_kunjungan,
        conversation_result: editOptions.conversation_result,
        approved_offer: noContact ? null : editOptions.approved_offer || null,
        unpaid_reason: noContact || editOptions.conversation_result === 'Sudah melakukan pembayaran'
          ? null : editOptions.unpaid_reason || null,
        planned_payment_date: promiseToPay ? editOptions.planned_payment_date : null,
      }
      const { data, error: updateError } = await createClient().from('visits').update(patch).eq('visit_id', row.visit_id).eq('agent_email', row.agent_email).select('*').single()
      if (updateError) throw updateError
      setRow(data as Visit)
      setEditOpen(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : tx('Unable to update visit.', 'Gagal mengubah kunjungan.'))
    } finally { setEditSaving(false) }
  }

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
      const { data: c } = await s.from('customers').select('*').eq('crl_id', data.crl_id).single()
      setCustomer((c || null) as Customer | null)

      const photoPaths = Array.isArray(data.visit_photo_urls) && data.visit_photo_urls.length > 0
        ? data.visit_photo_urls
        : data.visit_photo_url
          ? [data.visit_photo_url]
          : []

      const signedPhotos = await Promise.all(
        photoPaths.map(async (path: string) => {
          const { data: signed } = await s.storage.from('visit-evidence').createSignedUrl(path, 3600)
          return signed?.signedUrl || ''
        })
      )

      setPhotoUrls(signedPhotos.filter(Boolean))

      const optionalPaths = {
        payment: data.payment_photo_url || '',
        speedTest: data.speed_test_photo_url || '',
        other: data.other_photo_url || '',
      }
      const signedOptionalEntries = await Promise.all(
        Object.entries(optionalPaths).map(async ([key, path]) => {
          if (!path) return [key, ''] as const
          const { data: signed } = await s.storage.from('visit-evidence').createSignedUrl(path, 3600)
          return [key, signed?.signedUrl || ''] as const
        })
      )
      setOptionalPhotoUrls(Object.fromEntries(signedOptionalEntries) as {
        payment: string
        speedTest: string
        other: string
      })

      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return <main className={styles.page}><PageTop title={t('agent.visitDetail.title')} back /><div className={styles.loading}><Loading /></div></main>
  }

  if (error || !row) {
    return <main className={styles.page}><PageTop title={t('agent.visitDetail.title')} back /><div className={styles.errorCard}>{error || t('agent.visitDetail.notFound')}</div></main>
  }

  const newVisitCaseId = row.crl_id || customer?.crl_id || null
  const hasLocation = row.latitude !== null && row.longitude !== null
  const locationLabel = hasLocation ? `${row.latitude?.toFixed(6)}, ${row.longitude?.toFixed(6)}` : '—'

  return (
    <main className={styles.page}>
      <PageTop title={t('agent.visitDetail.titleDetail')} back />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{tx('VISIT RECORD', 'CATATAN KUNJUNGAN')}</span>
          <h1>{customer?.customer_name || row.customer_id}</h1>
          <p>{row.visit_id} · {row.customer_id} · {row.crl_id}</p>
        </div>
        <span className={styles.status}>{row.visit_result || t('agent.visitDetail.submitted')}</span>
      </section>

      <section className={styles.doneCard}>
        <Pencil />
        <div><strong>{tx('Record another visit for this customer.', 'Catat kunjungan baru untuk pelanggan ini.')}</strong><span>{tx('Previous visit records, GPS and evidence photos will be preserved.', 'Catatan, GPS, dan foto bukti kunjungan sebelumnya tetap tersimpan.')}</span></div>
        <button type="button" className={styles.mapButton} onClick={startEdit}>{tx('Edit options', 'Edit pilihan')}</button>
        {newVisitCaseId && <Link className={styles.mapButton} href={`/agent/customers/${encodeURIComponent(newVisitCaseId)}/visit`}>{tx('New Visit', 'Kunjungan Baru')}</Link>}
      </section>

      {editOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="edit-visit-options" className="my-auto w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-base-300 bg-base-100 p-5 shadow-2xl sm:p-7" style={{ maxHeight: 'calc(100dvh - 24px)' }}>
            <div><h2 id="edit-visit-options" className="text-xl font-black">{tx('Edit visit options', 'Edit pilihan kunjungan')}</h2>
              <p className="mt-1 text-sm opacity-65">{tx('Only dropdown answers can be changed. GPS, photos, date, and other evidence are preserved.', 'Hanya jawaban pilihan yang bisa diubah. GPS, foto, tanggal, dan bukti lainnya tetap tersimpan.')}</p></div>
            {([
              ['visit_status_kunjungan', tx('Visit status', 'Status kunjungan'), ['Bertemu dengan pelanggan', 'Pelanggan tidak ada di tempat', 'Alamat tidak ditemukan', 'Pelanggan sudah pindah', 'Tidak berhasil dikunjungi', 'Lainnya']],
              ['conversation_result', tx('Conversation result', 'Hasil percakapan'), ['Sudah melakukan pembayaran', 'Bersedia bayar / Promise to Pay', 'Masih mempertimbangkan', 'Tidak bersedia melanjutkan layanan', 'Tidak bertemu pelanggan']],
              ['approved_offer', tx('Approved offer', 'Offer disetujui'), [NO_APPROVED_OFFER, ...retentionOffersForCustomer(customer?.customer_id || row.customer_id).map((o) => o.value)]],
              ['unpaid_reason', tx('Unpaid reason', 'Alasan belum bayar'), ['Masalah keuangan', 'Harga / tagihan', 'Pindah ke provider lain', 'Masalah jaringan / layanan', 'Jarang digunakan', 'Pindah alamat', 'Masalah sales', 'Alasan pribadi', 'Lainnya']],
            ] as const).filter(([key]) => !((key === 'approved_offer' || key === 'unpaid_reason') && editOptions.conversation_result === 'Tidak bertemu pelanggan') && !(key === 'unpaid_reason' && editOptions.conversation_result === 'Sudah melakukan pembayaran')).map(([key, label, options]) => (
              <label key={key} className="block text-sm font-bold">{label}
                <select className="dui-select mt-2 w-full" value={editOptions[key]} onChange={(e) => setEditOptions((prev) => ({ ...prev, [key]: e.target.value }))}>
                  <option value="">{tx('Select option', 'Pilih opsi')}</option>
                  {options.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            ))}
            {editOptions.conversation_result === 'Bersedia bayar / Promise to Pay' && (
              <label className="block text-sm font-bold">
                {tx('Planned payment date', 'Rencana tanggal pembayaran')}
                <input type="date" className="dui-input mt-2 w-full" value={editOptions.planned_payment_date} onChange={(e) => setEditOptions((prev) => ({ ...prev, planned_payment_date: e.target.value }))} required />
              </label>
            )}
            {editError && <p role="alert" className="rounded-xl bg-error/10 p-3 text-sm text-error">{editError}</p>}
            <div className="flex gap-3 pt-2"><button type="button" className="dui-btn flex-1" disabled={editSaving} onClick={() => setEditOpen(false)}>{tx('Cancel', 'Batal')}</button><button type="button" className="dui-btn dui-btn-primary flex-1" disabled={editSaving} onClick={() => void saveEdit()}>{editSaving ? tx('Saving…', 'Menyimpan…') : tx('Save changes', 'Simpan perubahan')}</button></div>
          </section>
        </div>
      )}

      <section className={styles.summaryGrid}>
        <article className={`${styles.summaryCard} ${styles.tonePurple}`}><CalendarClock /><div><span>{t('agent.visitDetail.visitTime')}</span><strong>{dateTime(row.visit_date)}</strong></div></article>
        <article className={`${styles.summaryCard} ${styles.toneGreen}`}><ShieldCheck /><div><span>{t('agent.visitDetail.consent')}</span><strong>{row.consent_given ? t('agent.visitDetail.yes') : t('agent.visitDetail.no')}</strong></div></article>
        <article className={`${styles.summaryCard} ${styles.toneBlue}`}><MapPin /><div><span>{tx('GPS location', 'Lokasi GPS')}</span><strong>{locationLabel}</strong></div></article>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}><Gauge /><div><span>{tx('SPEED TEST', 'SPEED TEST')}</span><h2>{tx('Speed test result', 'Hasil speed test')}</h2></div></div>
        <div className={styles.coordinateGrid}>
          <div><span>{tx('Current speed', 'Speed saat ini')}</span><strong>{formatMbps(customer?.speed)}</strong></div>
          <div><span>Download</span><strong>{formatMbps(row.speed_test_download_mbps)}</strong></div>
          <div><span>Upload</span><strong>{formatMbps(row.speed_test_upload_mbps)}</strong></div>
        </div>
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
        {photoUrls.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {photoUrls.map((url, index) => (
              <img
                key={url}
                src={url}
                alt={`${t('agent.visitDetail.evidenceAlt')} ${index + 1}`}
                className={styles.photo}
              />
            ))}
          </div>
        ) : (
          <div className={styles.noPhoto}><ImageIcon /><strong>{tx('No evidence photo', 'Tidak ada foto bukti')}</strong><span>{tx('No photo was attached to this visit record.', 'Tidak ada foto yang dilampirkan pada catatan kunjungan ini.')}</span></div>
        )}
      </section>

      {(optionalPhotoUrls.payment || optionalPhotoUrls.speedTest || optionalPhotoUrls.other) && (
        <section className={styles.photoCard}>
          <div className={styles.cardTitle}><ImageIcon /><div><span>{tx('ADDITIONAL PHOTOS', 'FOTO TAMBAHAN')}</span><h2>{tx('Payment, speed test, and other photos', 'Foto pembayaran, speed test, dan lainnya')}</h2></div></div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: tx('Payment Photo', 'Foto Pembayaran'), url: optionalPhotoUrls.payment },
              { label: tx('Speed Test Photo', 'Foto Speed Test'), url: optionalPhotoUrls.speedTest },
              { label: tx('Other Photo', 'Foto Lainnya'), url: optionalPhotoUrls.other },
            ].map(({ label, url }) => (
              <div key={label} className="rounded-box border border-base-300 p-3">
                <div className="mb-2 text-sm font-semibold">{label}</div>
                {url ? (
                  <img src={url} alt={label} className={styles.photo} />
                ) : (
                  <div className="text-sm text-base-content/50">{tx('Not uploaded', 'Tidak diunggah')}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.doneCard}><CheckCircle2 /><div><strong>{tx('Visit record saved', 'Catatan kunjungan tersimpan')}</strong><span>{tx('This submitted record is available in your visit history.', 'Catatan yang dikirim ini tersedia di riwayat kunjungan Anda.')}</span></div></section>
    </main>
  )
}
