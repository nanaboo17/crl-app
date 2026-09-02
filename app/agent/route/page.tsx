'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LocateFixed, MapPin, Navigation, Route, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'
import { useI18n } from '@/components/providers/i18n-provider'

type Customer = {
  customer_id: string
  customer_name: string
  priority_rank: number | null
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

type GeocodeResponse = {
  found?: boolean
  latitude?: number
  longitude?: number
}

const MAX_ROUTE_DISTANCE_KM = 100
const NOMINATIM_DELAY_MS = 1100

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildCustomerAddress(customer: Customer) {
  return [
    customer.service_address,
    customer.sub_district,
    customer.district,
    customer.city,
    'Indonesia',
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(', ')
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const toRad = (value: number) => (value * Math.PI) / 180
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

export default function AgentRoutePage() {
  const { t } = useI18n()
  const supabase = createClient()
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

    async function geocodeMissingCustomers(rows: Customer[]) {
      const missing = rows.filter(
        (customer) =>
          customer.given_latitude == null || customer.given_longitude == null
      )

      for (let index = 0; index < missing.length; index += 1) {
        if (cancelled) return

        const customer = missing[index]
        const address = buildCustomerAddress(customer)

        if (!address) continue

        try {
          const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`)

          if (response.ok) {
            const result = (await response.json()) as GeocodeResponse

            if (
              result.found &&
              Number.isFinite(result.latitude) &&
              Number.isFinite(result.longitude)
            ) {
              setCustomers((current) =>
                current.map((row) =>
                  row.customer_id === customer.customer_id
                    ? {
                        ...row,
                        given_latitude: Number(result.latitude),
                        given_longitude: Number(result.longitude),
                      }
                    : row
                )
              )
            }
          }
        } catch (geocodeError) {
          console.error('route geocode:', geocodeError)
        }

        if (index < missing.length - 1) {
          await sleep(NOMINATIM_DELAY_MS)
        }
      }
    }

    async function loadData() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        window.location.href = '/login'
        return
      }

      const email = user.email.trim().toLowerCase()
      const { data: agent } = await supabase
        .from('agents')
        .select('agent_name, role, active')
        .eq('email', email)
        .maybeSingle()

      if (!agent || !agent.active || agent.role !== 'agent') {
        window.location.href = '/auth/route'
        return
      }

      const { data, error } = await supabase
        .from('customers')
        .select('customer_id, customer_name, priority_rank, service_address, city, district, sub_district, given_latitude, given_longitude, visit_status, payment_status, days_left_to_churn')
        .eq('agent_email', email)
        .order('priority_rank', { ascending: true })

      if (error) {
        setError(error.message)
      } else {
        const rows = (data ?? []) as Customer[]
        setCustomers(rows)
        void geocodeMissingCustomers(rows)
      }

      setAgentName(agent.agent_name)
      setLoading(false)
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [])

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
        setError(t('agent.route.gpsFailed', { message: gpsError.message }))
        setGettingGps(false)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  }

  const availableCustomers = useMemo(() => {
    if (latitude === null || longitude === null) return []
    return customers.filter((customer) => {
      const visited = customer.visit_status?.trim().toLowerCase() === 'visited'
      if (visited || customer.given_latitude == null || customer.given_longitude == null) return false
      const lat = Number(customer.given_latitude)
      const lng = Number(customer.given_longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
      return distanceMeters(latitude, longitude, lat, lng) <= MAX_ROUTE_DISTANCE_KM * 1000
    })
  }, [customers, latitude, longitude])

  const excludedCustomers = useMemo(() => {
    if (latitude === null || longitude === null) return []
    return customers
      .filter((customer) => {
        const visited = customer.visit_status?.trim().toLowerCase() === 'visited'
        if (visited || customer.given_latitude == null || customer.given_longitude == null) return false
        return distanceMeters(latitude, longitude, Number(customer.given_latitude), Number(customer.given_longitude)) > MAX_ROUTE_DISTANCE_KM * 1000
      })
      .map((customer) => ({
        ...customer,
        distanceFromAgent: distanceMeters(latitude, longitude, Number(customer.given_latitude), Number(customer.given_longitude)),
      }))
  }, [customers, latitude, longitude])

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
        const distance = distanceMeters(
          currentLat,
          currentLng,
          Number(customer.given_latitude),
          Number(customer.given_longitude)
        )
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
    const destination = route[route.length - 1]
    const waypoints = route
      .slice(0, -1)
      .map((customer) => `${customer.given_latitude},${customer.given_longitude}`)
      .join('|')

    let url = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${destination.given_latitude},${destination.given_longitude}&travelmode=driving`
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingCard}>{t('agent.route.loading')}</div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('agent.route.eyebrow')}</p>
          <h1>{t('agent.route.title')}</h1>
          <p className={styles.subtitle}><UserRound size={15} /> {agentName}</p>
        </div>
        <Link href="/agent" className={styles.backButton}>{t('agent.route.back')}</Link>
      </header>

      <section className={styles.heroGrid}>
        <div className={styles.locationCard}>
          <div className={styles.cardIcon}><LocateFixed size={20} /></div>
          <div className={styles.locationCopy}>
            <span>{t('agent.route.currentLocation')}</span>
            {latitude !== null && longitude !== null ? (
              <>
                <strong>{t('agent.route.locationCaptured')}</strong>
                <small>{latitude.toFixed(6)}, {longitude.toFixed(6)}</small>
                {accuracy !== null && <small>{t('agent.route.accuracy', { value: accuracy.toFixed(1) })}</small>}
              </>
            ) : (
              <strong>{t('agent.route.captureHint')}</strong>
            )}
          </div>
          <button type="button" className={styles.gpsButton} onClick={captureLocation} disabled={gettingGps}>
            {gettingGps ? t('agent.route.gettingLocation') : t('agent.route.useMyLocation')}
          </button>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}><span>{t('agent.route.needVisit')}</span><strong>{availableCustomers.length}</strong></div>
          <div className={styles.summaryCard}><span>{t('agent.route.routeStops')}</span><strong>{route.length}</strong></div>
        </div>
      </section>

      {error && <div className={styles.errorCard}>{error}</div>}

      {latitude !== null && longitude !== null && (
        <section className={styles.mapSection}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>{t('agent.route.mapTitle')}</p><h2>{t('agent.route.recommended')}</h2></div>
            {route.length > 0 && <span className={styles.countBadge}>{route.length}</span>}
          </div>
          <div className={styles.mapCard}>
            <iframe title={t('agent.route.mapTitle')} src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=14&output=embed`} loading="lazy" />
          </div>
          {route.length > 0 && (
            <button type="button" className={styles.routeButton} onClick={openFullRoute}>
              <Navigation size={17} /> {t('agent.route.openFullRoute')}
            </button>
          )}
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}><Route size={13} /> {t('agent.route.nearestFirst')}</p><h2>{t('agent.route.recommended')}</h2></div>
          <span className={styles.countBadge}>{route.length}</span>
        </div>

        {latitude === null ? (
          <div className={styles.emptyCard}>{t('agent.route.captureFirst')}</div>
        ) : route.length > 0 ? (
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
        ) : (
          <div className={styles.emptyCard}>{t('agent.route.captureFirst')}</div>
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
