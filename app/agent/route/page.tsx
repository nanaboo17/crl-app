'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LocateFixed, MapPin, Navigation, Route, UserRound, Search, SlidersHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'
import dynamic from 'next/dynamic'
import type { MapCustomer } from '@/components/agent/CustomerPinMap'

const CustomerPinMap = dynamic(() => import('@/components/agent/CustomerPinMap'), { ssr: false })

type Customer = {
  crl_id: string
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
  return customer.visit_status?.trim().toLowerCase() !== 'visited'
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
  const [searchText, setSearchText] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [mobileMap, setMobileMap] = useState(false)

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
          .select('crl_id, customer_id, customer_name, priority_rank, service_address, city, district, sub_district, given_latitude, given_longitude, visit_status, payment_status, days_left_to_churn')
          .ilike('agent_email', email)
          .eq('actionable', true)
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

  const availableCustomers = useMemo(
    () => actionableCustomers.filter(hasValidCoordinates),
    [actionableCustomers]
  )

  const customersWithoutCoordinates = useMemo(
    () => actionableCustomers.filter((customer) => !hasValidCoordinates(customer)),
    [actionableCustomers]
  )

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

  const visibleCustomers = useMemo(() => {
    if (latitude !== null && longitude !== null) {
      return [
        ...route,
        ...customersWithoutCoordinates.map((customer, index) => ({
          ...customer,
          sequence: route.length + index + 1,
          distance_from_previous: Number.NaN,
        })),
      ]
    }

    return actionableCustomers.map((customer, index) => ({
      ...customer,
      sequence: index + 1,
      distance_from_previous: Number.NaN,
    }))
  }, [actionableCustomers, customersWithoutCoordinates, latitude, longitude, route])

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

  const listedCustomers = visibleCustomers.filter((customer) => {
    if (priorityFilter !== 'all' && customer.priority_rank !== priorityFilter) return false
    const term = searchText.trim().toLowerCase()
    if (!term) return true
    return [customer.customer_name, customer.customer_id, customer.service_address, customer.city, customer.district]
      .some((value) => String(value ?? '').toLowerCase().includes(term))
  })

  if (loading) return <main className={styles.page}><div className={styles.loadingCard}>{t('agent.route.loading')}</div></main>

  return (
    <main className={styles.routeShell}>
      <aside className={`${styles.sidebar} ${mobileMap ? styles.mobileHidden : ''}`}>
        <div className={styles.sidebarTop}>
          <span className={styles.brandMark}><Route size={21} /></span>
          <div className={styles.brandText}><strong>CRL Route</strong><small>{agentName}</small></div>
        </div>

        <div className={styles.sidebarTools}>
          <h1>{tx('Your field stops', 'Rute kunjungan')}</h1>
          <p>{tx('Find customers and plan your next visit.', 'Cari pelanggan dan rencanakan kunjungan berikutnya.')}</p>
          <label className={styles.searchBox}>
            <Search size={17} aria-hidden="true" />
            <input value={searchText} onChange={(e) => setSearchText(e.target.value)}
              placeholder={tx('Search customers…', 'Cari pelanggan…')}
              aria-label={tx('Search customers', 'Cari pelanggan')} />
          </label>
          <div className={styles.filterRow}>
            <label><span><SlidersHorizontal size={14} /> {tx('Priority', 'Prioritas')}</span>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value="all">{tx('All priorities', 'Semua prioritas')}</option>
                {['P1', 'P2', 'P3', 'P4', 'P5'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <span className={styles.stopTotal}>{listedCustomers.length} {tx('stops', 'tujuan')}</span>
          </div>
          <button className={styles.locateButton} onClick={captureLocation} disabled={gettingGps}>
            <LocateFixed size={17} />
            {gettingGps ? t('agent.route.gettingLocation') : latitude !== null ? tx('Update my location', 'Perbarui lokasi saya') : t('agent.route.useMyLocation')}
          </button>
          {latitude !== null && <p className={styles.gpsStatus}>{tx('GPS ready', 'GPS siap')}{accuracy != null ? ` · ±${Math.round(accuracy)} m` : ''}</p>}
          {error && <div className={styles.inlineError} role="alert">{error}</div>}
          {missingCoordinateCount > 0 && <p className={styles.gpsNotice}>{missingCoordinateCount} {tx('customers have no map coordinates.', 'pelanggan belum memiliki koordinat peta.')}</p>}
        </div>

        <div className={styles.stopList}>
          {listedCustomers.length === 0 && <div className={styles.emptyStops}>{tx('No customers match your filters.', 'Tidak ada pelanggan yang sesuai filter.')}</div>}
          {listedCustomers.map((customer) => (
            <article key={customer.crl_id} className={styles.stopItem}>
              <div className={styles.stopNumber}>{customer.sequence}</div>
              <div className={styles.stopDetails}>
                <div className={styles.stopHeading}><strong>{customer.customer_name || customer.customer_id}</strong><span className={styles.priority}>{customer.priority_rank || '—'}</span></div>
                <p className={styles.customerId}>{customer.customer_id}</p>
                <p className={styles.stopAddress}><MapPin size={13} />{customer.service_address || customer.sub_district || customer.district || customer.city || '—'}</p>
                <div className={styles.stopMeta}><span>{Number.isFinite(customer.distance_from_previous) ? formatDistance(customer.distance_from_previous) : hasValidCoordinates(customer) ? tx('Capture GPS for distance', 'Aktifkan GPS untuk jarak') : tx('No coordinates', 'Tanpa koordinat')}</span><span>{customer.days_left_to_churn ?? '—'} {tx('days left', 'hari lagi')}</span></div>
                <div className={styles.stopActions}>
                  <Link href={`/agent/customers/${encodeURIComponent(customer.crl_id)}`}>{t('agent.route.customerDetail')}</Link>
                  {hasValidCoordinates(customer) && <a href={`https://www.google.com/maps/dir/?api=1&destination=${customer.given_latitude},${customer.given_longitude}&travelmode=driving`} target="_blank" rel="noopener noreferrer"><Navigation size={13}/>{t('agent.route.navigate')}</a>}
                </div>
              </div>
            </article>
          ))}
        </div>
        {route.length > 0 && <div className={styles.sidebarFooter}><button onClick={openFullRoute} className={styles.routeButton}><Navigation size={17} />{t('agent.route.openFullRoute')}</button></div>}
      </aside>

      <section className={`${styles.mapPane} ${mobileMap ? styles.mobileMapVisible : ''}`} aria-label={tx('Customer location map', 'Peta lokasi pelanggan')}>
        <div className={styles.mapToolbar}>
          <div><strong>{tx('Customer map', 'Peta pelanggan')}</strong><span>{availableCustomers.length} {tx('mapped stops', 'tujuan pada peta')}</span></div>
          <button type="button" onClick={captureLocation} disabled={gettingGps} title={tx('Locate me', 'Lokasi saya')}><LocateFixed size={20} /></button>
        </div>
        {availableCustomers.length > 0
          ? <CustomerPinMap customers={availableCustomers as MapCustomer[]} agentPosition={latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null} locale={locale} />
          : <div className={styles.emptyMap}><MapPin size={30}/>{tx('No mapped customers yet.', 'Belum ada pelanggan dengan lokasi peta.')}</div>}
        <div className={styles.mapLegend}><i className={styles.redDot}/> P1 <i className={styles.orangeDot}/> P2 <i className={styles.purpleDot}/> P3–P5 <i className={styles.blueDot}/> GPS</div>
      </section>
      <button type="button" className={styles.mobileToggle} onClick={() => setMobileMap(!mobileMap)}>{mobileMap ? tx('View stops', 'Lihat daftar') : tx('View map', 'Lihat peta')}</button>
    </main>
  )
}
