'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { PreVisit, Customer } from '@/lib/types'
import { dateTime } from '@/lib/format'
import PageTop from '@/components/PageTop'
import Loading from '@/components/Loading'
import StatusPill from '@/components/StatusPill'
import { useI18n } from '@/components/providers/i18n-provider'

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
      const { data, error } = await s
        .from('pre_visits')
        .select('*')
        .eq('previsit_id', id)
        .single()
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setRow(data as PreVisit)
      const { data: c } = await s
        .from('customers')
        .select('*')
        .eq('customer_id', data.customer_id)
        .single()
      setCustomer((c || null) as Customer | null)
      setLoading(false)
    })()
  }, [id])

  const customerLat = customer?.given_latitude ?? null
  const customerLng = customer?.given_longitude ?? null
  const hasCoords =
    customerLat != null && customerLng != null
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
    const dest = `${customerLat},${customerLng}`
    const origin = agentLat != null && longitude != null ? `&origin=${agentLat},${longitude}` : ''
    window.open(
      `https://www.google.com/maps/dir/?api=1${origin}&destination=${dest}&travelmode=driving`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  if (loading)
    return (
      <main className="container">
        <PageTop title={t('agent.preVisitDetail.title')} back />
        <Loading />
      </main>
    )
  if (error || !row)
    return (
      <main className="container">
        <PageTop title={t('agent.preVisitDetail.title')} back />
        <div className="card error-card">{error || t('agent.preVisitDetail.notFound')}</div>
      </main>
    )

  return (
    <main className="container">
      <PageTop title={t('agent.preVisitDetail.titleDetail')} back />
      <section className="card">
        <div className="card-row">
          <div>
            <strong>{customer?.customer_name || row.customer_id}</strong>
            <div className="muted small">{row.previsit_id}</div>
          </div>
          <StatusPill>{row.previsit_status}</StatusPill>
        </div>
        <div className="detail-grid">
          <div>
            <span>{t('agent.preVisitDetail.contactConfirmed')}</span>
            <strong>{row.contact_confirmed ? t('agent.preVisitDetail.yes') : t('agent.preVisitDetail.no')}</strong>
          </div>
          <div>
            <span>{t('agent.preVisitDetail.addressConfirmed')}</span>
            <strong>{row.address_confirmed ? t('agent.preVisitDetail.yes') : t('agent.preVisitDetail.no')}</strong>
          </div>
          <div>
            <span>{t('agent.preVisitDetail.appointment')}</span>
            <strong>{dateTime(row.appointment_date)}</strong>
          </div>
          <div>
            <span>{t('agent.preVisitDetail.contactResult')}</span>
            <strong>{row.contact_result || '—'}</strong>
          </div>
        </div>
        <div className="detail-block">
          <span>{t('agent.preVisitDetail.addressLandmark')}</span>
          <p>
            {row.confirmed_address || customer?.service_address || '—'}
            {row.landmark ? ` · ${row.landmark}` : ''}
          </p>
        </div>
        <div className="detail-block">
          <span>{t('agent.preVisitDetail.notes')}</span>
          <p>{row.previsit_notes || '—'}</p>
        </div>
      </section>

      {hasCoords ? (
        <section className="card section">
          <h2 className="map-section-title">{t('agent.preVisitDetail.routeTitle')}</h2>
          <p className="map-hint">{t('agent.preVisitDetail.routeHint')}</p>

          <iframe
            title={t('agent.preVisitDetail.mapTitle')}
            className="map-embed"
            src={`https://maps.google.com/maps?q=${customerLat},${customerLng}&z=14&output=embed`}
            loading="lazy"
          />

          <div className="gps-card">
            <div>
              <strong>{t('agent.preVisitDetail.customerLocation')}</strong>
              <p className="muted small">
                {Number(customerLat).toFixed(6)}, {Number(customerLng).toFixed(6)}
              </p>
              {agentLat != null && longitude != null && distance != null ? (
                <div className="gps-values">
                  <span>
                    {t('agent.preVisitDetail.distanceAway', {
                      distance: formatDistance(distance),
                    })}
                  </span>
                  <span>
                    {distance <= 1000 ? t('agent.preVisitDetail.nearbyLabel') : t('agent.preVisitDetail.farLabel')}
                  </span>
                  {accuracy != null ? (
                    <span>{t('agent.preVisitDetail.accuracy', { value: accuracy.toFixed(1) })}</span>
                  ) : null}
                </div>
              ) : (
                <p className="muted small">{t('agent.preVisitDetail.noLocationYet')}</p>
              )}
            </div>
            {agentLat == null && (
              <button type="button" className="btn secondary" onClick={captureLocation} disabled={gettingGps}>
                {gettingGps ? t('agent.preVisitDetail.gettingLocation') : t('agent.preVisitDetail.useMyLocation')}
              </button>
            )}
          </div>

          {gpsError ? <div className="card error-card section-sm">{gpsError}</div> : null}

          <div className="actions section-sm">
            <button type="button" className="btn compact" onClick={openDirections}>
              {t('agent.preVisitDetail.visitDirectly')}
            </button>
            <p className="muted small">{t('agent.preVisitDetail.visitDirectlyHint')}</p>
          </div>
        </section>
      ) : (
        <section className="card section">
          <h2 className="map-section-title">{t('agent.preVisitDetail.routeTitle')}</h2>
          <p className="map-hint">{t('agent.preVisitDetail.noCoordinates')}</p>
        </section>
      )}

      {row.previsit_status === 'Ready for Visit' && (
        <section className="section">
          <Link className="btn" href={`/agent/visits/new?customer=${encodeURIComponent(row.customer_id)}`}>
            {t('agent.preVisitDetail.startVisit')}
          </Link>
        </section>
      )}
    </main>
  )
}
