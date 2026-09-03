'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CalendarClock, CheckCircle2, ClipboardList, LocateFixed, MapPin, Navigation, StickyNote } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import type { PreVisit, Customer } from '@/lib/types'
import { dateTime } from '@/lib/format'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export default function PreVisitDetailPage() {
  const { t } = useI18n()
  const params = useParams<{ id: string }>()
  const id = decodeURIComponent(params.id)
  const [row, setRow] = useState<PreVisit | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [gettingGps, setGettingGps] = useState(false)
  const [gpsError, setGpsError] = useState('')

  useEffect(() => {
    ;(async () => {
      const s = createClient()
      const { data, error } = await s.from('pre_visits').select('*').eq('previsit_id', id).single()
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setRow(data as PreVisit)
      const { data: c } = await s.from('customers').select('*').eq('customer_id', data.customer_id).single()
      setCustomer((c || null) as Customer | null)
      setLoading(false)
    })()
  }, [id])

  const customerLat = customer?.given_latitude ?? null
  const customerLng = customer?.given_longitude ?? null
  const hasCoords = customerLat != null && customerLng != null
  const agentLat = latitude != null ? Number(latitude) : null
  const distance =
    agentLat != null && longitude != null && hasCoords
      ? distanceMeters(agentLat, Number(longitude), Number(customerLat), Number(customerLng))
      : null

  function captureLocation() {
    if (!navigator.geolocation) {
      setGpsError(t('agent.preVisitDetail.gpsNotSupported'))
      return
    }
    setGettingGps(true)
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude)
        setLongitude(position.coords.longitude)
        setAccuracy(position.coords.accuracy)
        setGettingGps(false)
      },
      (gpsErr) => {
        setGpsError(t('agent.preVisitDetail.gpsFailed', { message: gpsErr.message }))
        setGettingGps(false)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  }

  function openDirections() {
    if (!hasCoords) return
    const destination = `${customerLat},${customerLng}`
    const origin = agentLat != null && longitude != null ? `&origin=${agentLat},${longitude}` : ''
    window.open(`https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}&travelmode=driving`, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return <main className={styles.page}><PageTop title={t('agent.preVisitDetail.title')} back /><div className={styles.loading}><Loading /></div></main>
  }

  if (error || !row) {
    return <main className={styles.page}><PageTop title={t('agent.preVisitDetail.title')} back /><div className={styles.errorPage}>{error || t('agent.preVisitDetail.notFound')}</div></main>
  }

  const canStartVisit = row.previsit_status === 'Ready for Visit' || row.previsit_status === 'Direct Visit'

  return (
    <main className={styles.page}>
      <PageTop title={t('agent.preVisitDetail.titleDetail')} back />

      <section className={styles.heroCard}>
        <div>
          <h1 className={styles.heroName}>{customer?.customer_name || row.customer_id}</h1>
          <div className={styles.heroMeta}>{row.previsit_id} · {row.customer_id}</div>
        </div>
        <span className={styles.status}>{row.previsit_status}</span>
      </section>

      <div className={styles.grid}>
        <section className={styles.detailCard}>
          <h2 className={styles.sectionTitle}><ClipboardList size={18} /> {t('agent.preVisitDetail.title')}</h2>
          <div className={styles.detailGrid}>
            <div className={styles.detailItem}><span>{t('agent.preVisitDetail.contactConfirmed')}</span><strong>{row.contact_confirmed ? t('agent.preVisitDetail.yes') : t('agent.preVisitDetail.no')}</strong></div>
            <div className={styles.detailItem}><span>{t('agent.preVisitDetail.addressConfirmed')}</span><strong>{row.address_confirmed ? t('agent.preVisitDetail.yes') : t('agent.preVisitDetail.no')}</strong></div>
            <div className={styles.detailItem}><span>{t('agent.preVisitDetail.appointment')}</span><strong>{dateTime(row.appointment_date)}</strong></div>
            <div className={styles.detailItem}><span>{t('agent.preVisitDetail.contactResult')}</span><strong>{row.contact_result || '—'}</strong></div>
          </div>
          <div className={styles.block}>
            <span>{t('agent.preVisitDetail.addressLandmark')}</span>
            <p>{row.confirmed_address || customer?.service_address || '—'}{row.landmark ? ` · ${row.landmark}` : ''}</p>
          </div>
        </section>

        <section className={styles.detailCard}>
          <h2 className={styles.sectionTitle}><StickyNote size={18} /> {t('agent.preVisitDetail.notes')}</h2>
          <div className={styles.block}>
            <span>{t('agent.preVisitDetail.notes')}</span>
            <p>{row.previsit_notes || '—'}</p>
          </div>
          <div className={styles.block}>
            <span>{t('agent.preVisitDetail.appointment')}</span>
            <p><CalendarClock size={14} style={{ display: 'inline', marginRight: 6 }} />{dateTime(row.appointment_date)}</p>
          </div>
        </section>
      </div>

      <section className={styles.routeCard}>
        <div className={styles.routeHeader}>
          <div>
            <h2>{t('agent.preVisitDetail.routeTitle')}</h2>
            <p>{hasCoords ? t('agent.preVisitDetail.routeHint') : t('agent.preVisitDetail.noCoordinates')}</p>
          </div>
          <MapPin size={20} />
        </div>

        {hasCoords ? (
          <>
            <div className={styles.map}>
              <iframe title={t('agent.preVisitDetail.mapTitle')} src={`https://maps.google.com/maps?q=${customerLat},${customerLng}&z=15&output=embed`} loading="lazy" />
            </div>

            <div className={styles.locationBar}>
              <div className={styles.locationIcon}><LocateFixed size={18} /></div>
              <div className={styles.locationCopy}>
                <span>{t('agent.preVisitDetail.customerLocation')}</span>
                <strong>{customer?.service_address || row.confirmed_address || '—'}</strong>
                <small>{Number(customerLat).toFixed(6)}, {Number(customerLng).toFixed(6)}</small>
                {agentLat != null && longitude != null && distance != null && (
                  <div className={styles.distanceRow}>
                    <span>{t('agent.preVisitDetail.distanceAway', { distance: formatDistance(distance) })}</span>
                    <span>{distance <= 1000 ? t('agent.preVisitDetail.nearbyLabel') : t('agent.preVisitDetail.farLabel')}</span>
                    {accuracy != null && <span>{t('agent.preVisitDetail.accuracy', { value: accuracy.toFixed(1) })}</span>}
                  </div>
                )}
              </div>
              <button type="button" className={styles.gpsButton} onClick={captureLocation} disabled={gettingGps}>
                {gettingGps ? t('agent.preVisitDetail.gettingLocation') : t('agent.preVisitDetail.useMyLocation')}
              </button>
            </div>

            {gpsError && <div className={styles.error}>{gpsError}</div>}
            <button type="button" className={styles.directionButton} onClick={openDirections}><Navigation size={16} /> {t('agent.preVisitDetail.visitDirectly')}</button>
          </>
        ) : (
          <div className={styles.emptyMap}>{t('agent.preVisitDetail.noCoordinates')}</div>
        )}
      </section>

      {canStartVisit && (
        <section className={styles.actionCard}>
          <Link className={styles.startButton} href={`/agent/customers/${encodeURIComponent(row.customer_id)}/visit`}>
            <CheckCircle2 size={17} /> {t('agent.preVisitDetail.startVisit')}
          </Link>
        </section>
      )}
    </main>
  )
}
