'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LocateFixed, MapPin, Navigation, Route, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

type Customer = {
  customer_id: string
  customer_name: string
  priority_rank: string | null
  service_address: string | null
  city: string | null
  district: string | null
  sub_district: string | null
  given_latitude: number | null
  given_longitude: number | null
  visit_status: string | null
  payment_status: string | null
  days_left_to_churn: number | null
}

type RouteCustomer = Customer & {
  distance_from_previous: number
  sequence: number
}

const MAX_ROUTE_DISTANCE_KM = 100
const MAX_GOOGLE_MAPS_STOPS = 9

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function hasValidCoordinates(customer: Customer) {
  if (customer.given_latitude == null || customer.given_longitude == null) return false
  const lat = Number(customer.given_latitude)
  const lng = Number(customer.given_longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

function needsVisit(customer: Customer) {
  const visited = customer.visit_status?.trim().toLowerCase() === 'visited'
  const paid = customer.payment_status?.trim().toLowerCase() === 'paid'
  return !visited && !paid
}

export default function AgentRoutePage() {
  const { t, locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = useMemo(() => createClient(), [])

  const [customers, setCustomers] = useState<Customer[]>([])
  const [agentName, setAgentName] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [gettingGps, setGettingGps] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user?.email) {
          window.location.replace('/login')
          return
        }

        const email = user.email.trim().toLowerCase()
        const { data: agent, error: agentError } = await supabase
          .from('agents')
          .select('agent_name, role, active')
          .ilike('email', email)
          .maybeSingle()

        if (agentError) throw agentError
        if (!agent || !agent.active) {
          window.location.replace('/auth/route')
          return
        }
        if (agent.role !== 'agent') {
          window.location.replace(agent.role === 'superadmin' ? '/superadmin' : '/admin')
          return
        }

        const { data, error: customerError } = await supabase
          .from('customers')
          .select('customer_id, customer_name, priority_rank, service_address, city, district, sub_district, given_latitude, given_longitude, visit_status, payment_status, days_left_to_churn')
          .ilike('agent_email', email)
          .order('priority_rank', { ascending: true })

        if (customerError) throw customerError
        if (cancelled) return

        setAgentName(agent.agent_name || email)
        setCustomers((data ?? []) as Customer[])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : tx('Unable to load route data.', 'Tidak dapat memuat data rute.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadData()
    return () => { cancelled = true }
  }, [supabase, locale])

  function captureLocation() {
    if (!navigator.geolocation) {
      setError(t('agent.route.gpsNotSupported'))
      return
    }

    setGettingGps(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude)
        setLongitude(position.coords.longitude)
        setAccuracy(position.coords.accuracy)
        setGettingGps(false)
      },
      (gpsError) => {
        const message = gpsError.code === 1
          ? tx('Location permission is blocked. Allow location access in your browser settings, then try again.', 'Izin lokasi diblokir. Aktifkan izin lokasi pada pengaturan browser, lalu coba lagi.')
          : gpsError.code === 3
            ? tx('GPS timed out. Move to an open area and try again.', 'GPS kehabisan waktu. Pindah ke area yang lebih terbuka lalu coba lagi.')
            : t('agent.route.gpsFailed', { message: gpsError.message })
        setError(message)
        setGettingGps(false)
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 15000 }
    )
  }

  const actionableCustomers = useMemo(() => customers.filter(needsVisit), [customers])
  const missingCoordinateCount = useMemo(
    () => actionableCustomers.filter((customer) => !hasValidCoordinates(customer)).length,
    [actionableCustomers]
  )

  const availableCustomers = useMemo(() => {
    if (latitude === null || longitude === null) return []
    return actionableCustomers.filter((customer) => {
      if (!hasValidCoordinates(customer)) return false
      return distanceMeters(latitude, longitude, Number(customer.given_latitude), Number(customer.given_longitude)) <= MAX_ROUTE_DISTANCE_KM * 1000
    })
  }, [actionableCustomers, latitude, longitude])

  const excludedCustomers = useMemo(() => {
    if (latitude === null || longitude === null) return []
    return actionableCustomers
      .filter((customer) => {
        if (!hasValidCoordinates(customer)) return false
        return distanceMeters(latitude, longitude, Number(customer.given_latitude), Number(customer.given_longitude)) > MAX_ROUTE_DISTANCE_KM * 1000
      })
      .map((customer) => ({
        ...customer,
        distanceFromAgent: distanceMeters(latitude, longitude, Number(customer.given_latitude), Number(customer.given_longitude)),
      }))
  }, [actionableCustomers, latitude, longitude])

  const route = useMemo<RouteCustomer[]>(() => {
    if (latitude === null || longitude === null) return []

    const remaining = [...availableCustomers]
    const result: RouteCustomer[] = []
    let currentLat = latitude
    let currentLng = longitude
    let sequence = 1

    while (remaining.length > 0) {
      let nearestIndex = 0
      let nearestDistance = Infinity

      remaining.forEach((customer, index) => {
        const distance = distanceMeters(currentLat, currentLng, Number(customer.given_latitude), Number(customer.given_longitude))
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = index
        }
      })

      const nearest = remaining.splice(nearestIndex, 1)[0]
      result.push({ ...nearest, sequence, distance_from_previous: nearestDistance })
      currentLat = Number(nearest.given_latitude)
      currentLng = Number(nearest.given_longitude)
      sequence += 1
    }

    return result
  }, [latitude, longitude, availableCustomers])

  function openFullRoute() {
    if (latitude === null || longitude === null || route.length === 0) return

    const mapStops = route.slice(0, MAX_GOOGLE_MAPS_STOPS)
    const destination = mapStops[mapStops.length - 1]
    const waypoints = mapStops
      .slice(0, -1)
      .map((customer) => `${customer.given_latitude},${customer.given_longitude}`)
      .join('|')

    let url = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${destination.given_latitude},${destination.given_longitude}&travelmode=driving`
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <main className={styles.page}><div className={styles.loadingCard}>{t('agent.route.loading')}</div></main>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('agent.route.eyebrow')}</p>
          <h1>{t('agent.route.title')}</h1>
          <p className={styles.subtitle}><UserRound size={15} /> {agentName}</p>
        </div>
        <div className="dui-tooltip dui-tooltip-left" data-tip={tx('Back to agent dashboard', 'Kembali ke dashboard agent')}>
          <Link href="/agent" className={styles.backButton}>{t('agent.route.back')}</Link>
        </div>
      </header>

      <section className={styles.heroGrid}>
        <div className={styles.locationCard}>
          <div className="dui-tooltip" data-tip={tx('Uses your phone GPS to calculate nearby route stops', 'Menggunakan GPS ponsel untuk menghitung rute pelanggan terdekat')}>
            <div className={styles.cardIcon}><LocateFixed size={20} /></div>
          </div>
          <div className={styles.locationCopy}>
            <span>{t('agent.route.currentLocation')}</span>
            {latitude !== null && longitude !== null ? <>
              <strong>{t('agent.route.locationCaptured')}</strong>
              <small>{latitude.toFixed(6)}, {longitude.toFixed(6)}</small>
              {accuracy !== null && <small>{t('agent.route.accuracy', { value: accuracy.toFixed(1) })}</small>}
            </> : <strong>{t('agent.route.captureHint')}</strong>}
          </div>
          <div className="dui-tooltip dui-tooltip-left" data-tip={tx('Capture your latest high-accuracy GPS position', 'Ambil posisi GPS terbaru dengan akurasi tinggi')}>
            <button type="button" className={styles.gpsButton} onClick={captureLocation} disabled={gettingGps}>
              {gettingGps ? t('agent.route.gettingLocation') : t('agent.route.useMyLocation')}
            </button>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}><span>{tx('Assigned / need visit', 'Ditugaskan / perlu dikunjungi')}</span><strong>{actionableCustomers.length}</strong></div>
          <div className={styles.summaryCard}><span>{t('agent.route.routeStops')}</span><strong>{route.length}</strong></div>
        </div>
      </section>

      {error && <div className={styles.errorCard}>{error}</div>}
      {missingCoordinateCount > 0 && (
        <div className={styles.warningCard}>
          <h2>{tx('Some customers have no coordinates', 'Sebagian pelanggan belum memiliki koordinat')}</h2>
          <p>{tx(`${missingCoordinateCount} assigned customers are excluded from route calculation until coordinates are available.`, `${missingCoordinateCount} pelanggan yang ditugaskan belum masuk perhitungan rute karena koordinat belum tersedia.`)}</p>
        </div>
      )}

      {latitude !== null && longitude !== null && (
        <section className={styles.mapSection}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>{t('agent.route.mapTitle')}</p><h2>{t('agent.route.recommended')}</h2></div>
            {route.length > 0 && <span className={styles.countBadge}>{route.length}</span>}
          </div>
          <div className={styles.mapCard}>
            <iframe title={t('agent.route.mapTitle')} src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=14&output=embed`} loading="lazy" />
          </div>
          {route.length > 0 && <button type="button" className={styles.routeButton} onClick={openFullRoute}><Navigation size={17} /> {t('agent.route.openFullRoute')}</button>}
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}><Route size={13} /> {t('agent.route.nearestFirst')}</p><h2>{t('agent.route.recommended')}</h2></div>
          <span className={styles.countBadge}>{route.length}</span>
        </div>

        {latitude === null || longitude === null ? (
          <div className={styles.emptyCard}>{t('agent.route.captureFirst')}</div>
        ) : route.length === 0 ? (
          <div className={styles.emptyCard}>{tx('No route-ready customers found near your location.', 'Tidak ada pelanggan dengan data rute yang siap di dekat lokasi Anda.')}</div>
        ) : (
          <div className={styles.routeList}>
            {route.map((customer) => (
              <article key={customer.customer_id} className={styles.stopCard}>
                <div className={styles.sequence}>{customer.sequence}</div>
                <div className={styles.stopContent}>
                  <div className={styles.stopHeader}>
                    <div><h3>{customer.customer_name}</h3><p>{customer.customer_id}</p></div>
                    <strong className={styles.distance}>{formatDistance(customer.distance_from_previous)}</strong>
                  </div>
                  <div className={styles.stopInfo}>
                    <span>{t('agent.route.priorityLabel', { value: customer.priority_rank ?? '-' })}</span>
                    <span>{customer.payment_status?.toUpperCase() || t('agent.route.notSet')}</span>
                    <span>{t('agent.route.churnLabel', { days: customer.days_left_to_churn ?? '-' })}</span>
                  </div>
                  <p className={styles.address}><MapPin size={14} /> {customer.service_address || customer.sub_district || customer.district || customer.city || '-'}</p>
                  <div className={styles.actions}>
                    <Link href={`/agent/customers/${encodeURIComponent(customer.customer_id)}`} className={styles.detailButton}>{t('agent.route.customerDetail')}</Link>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${customer.given_latitude},${customer.given_longitude}&travelmode=driving`} target="_blank" rel="noreferrer" className={styles.navigateButton}><Navigation size={15} /> {t('agent.route.navigate')}</a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {excludedCustomers.length > 0 && (
        <section className={styles.warningCard}>
          <h2>{t('agent.route.warningTitle')}</h2>
          <p>{t('agent.route.warningBody', { km: MAX_ROUTE_DISTANCE_KM })}</p>
          <div className={styles.warningList}>
            {excludedCustomers.map((customer) => (
              <div key={customer.customer_id} className={styles.warningCustomer}>
                <div><strong>{customer.customer_name}</strong><span>{customer.customer_id}</span></div>
                <span>{t('agent.route.kmAway', { km: (customer.distanceFromAgent / 1000).toFixed(1) })}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
