'use client'

import { useEffect, useRef, useState } from 'react'

export type MapCustomer = {
  crl_id: string
  customer_id: string
  customer_name: string
  priority_rank: string | null
  service_address: string | null
  city: string | null
  given_latitude: number | null
  given_longitude: number | null
  visit_status: string | null
}

export type FatCandidate = {
  fat_id: string
  siteid: string | null
  siteid_brand: string | null
  fat_lat: number | null
  fat_lon: number | null
  capacity: number | null
  available: number | null
  address: string | null
  distance_meters: number | null
}

type Props = {
  fatCandidates?: FatCandidate[]
  customers: MapCustomer[]
  agentPosition?: { lat: number; lng: number } | null
  locale: string
  routeStops?: MapCustomer[]
  selectedCustomerId?: string | null
  onSelectCustomer?: (crlId: string) => void
}

type LeafletMap = {
  setView: (point: [number, number], zoom: number) => LeafletMap
  fitBounds: (bounds: [number, number][], options?: { padding?: [number, number]; maxZoom?: number }) => void
  remove: () => void
  panTo: (point: [number,number]) => void
}
type LeafletInstance = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void }
  polyline: (points: [number,number][], options: Record<string,unknown>) => { addTo: (map: LeafletMap) => void }
  divIcon: (options: Record<string,unknown>) => unknown
  marker: (point: [number,number], options: Record<string,unknown>) => { addTo: (map: LeafletMap) => { on: (name:string,fn:()=>void)=>void; bindPopup:(content:HTMLElement)=>void; openPopup:()=>void } }
  circleMarker: (point: [number, number], options: Record<string, unknown>) => {
    addTo: (map: LeafletMap) => { bindPopup: (content: HTMLElement) => void }
  }
}
declare global { interface Window { L?: LeafletInstance } }

const JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
let leafletLoading: Promise<LeafletInstance> | null = null

function loadLeaflet(): Promise<LeafletInstance> {
  if (window.L) return Promise.resolve(window.L)
  if (leafletLoading) return leafletLoading
  leafletLoading = new Promise<LeafletInstance>((resolve, reject) => {
    if (!document.querySelector('link[data-crl-leaflet]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = CSS
      link.dataset.crlLeaflet = 'true'
      document.head.appendChild(link)
    }
    const script = document.createElement('script')
    script.src = JS
    script.async = true
    script.onload = () => window.L ? resolve(window.L) : reject(new Error('Leaflet failed to initialize'))
    script.onerror = () => reject(new Error('Unable to load the map library'))
    document.head.appendChild(script)
  }).catch((error) => {
    leafletLoading = null
    throw error
  })
  return leafletLoading
}

function popup(customer: MapCustomer, locale: string): HTMLElement {
  const root = document.createElement('div')
  root.style.cssText = 'min-width:190px;max-width:250px;display:grid;gap:6px'
  const name = document.createElement('strong')
  name.textContent = customer.customer_name || customer.customer_id
  root.appendChild(name)
  for (const value of [
    `Customer ID: ${customer.customer_id}`,
    `CRL ID: ${customer.crl_id}`,
    `${locale === 'id' ? 'Prioritas' : 'Priority'}: ${customer.priority_rank || '-'}`,
    `${locale === 'id' ? 'Status kunjungan' : 'Visit status'}: ${customer.visit_status || '-'}`,
    customer.service_address || customer.city || '',
  ]) {
    if (!value) continue
    const detail = document.createElement('span')
    detail.textContent = value
    root.appendChild(detail)
  }
  const link = document.createElement('a')
  link.href = `/agent/customers/${encodeURIComponent(customer.crl_id)}`
  link.textContent = locale === 'id' ? 'Lihat detail pelanggan →' : 'View customer details →'
  link.style.cssText = 'font-weight:700;color:#6944b5;margin-top:5px'
  root.appendChild(link)
  return root
}

export default function CustomerPinMap({ customers, agentPosition, locale, routeStops = [], selectedCustomerId, onSelectCustomer, fatCandidates = [] }: Props) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('')
  const selectionRef = useRef(onSelectCustomer)
  selectionRef.current = onSelectCustomer
  useEffect(() => {
    let stopped = false
    let map: LeafletMap | null = null
    if (!elementRef.current || customers.length === 0) return
    setStatus('')
    void loadLeaflet().then((L) => {
      if (stopped || !elementRef.current) return
      const valid = customers.filter((c) => c.given_latitude != null && c.given_longitude != null)
      if (!valid.length) return
      map = L.map(elementRef.current, { scrollWheelZoom: false }).setView([Number(valid[0].given_latitude), Number(valid[0].given_longitude)], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)
      const bounds: [number, number][] = []
      const numbered = new Map(routeStops.map((stop, i) => [stop.crl_id, i + 1]))
      const orderedCoordinates = routeStops
        .filter((stop) => stop.given_latitude != null && stop.given_longitude != null)
        .map((stop): [number,number] => [Number(stop.given_latitude),Number(stop.given_longitude)])
      if (orderedCoordinates.length > 1) {
        L.polyline(agentPosition ? [[agentPosition.lat,agentPosition.lng], ...orderedCoordinates] : orderedCoordinates, {
          color:'#7651c5',weight:3,opacity:.8,dashArray:'7 8',
        }).addTo(map)
      }
      for (const customer of valid) {
        const pos: [number, number] = [Number(customer.given_latitude), Number(customer.given_longitude)]
        bounds.push(pos)
        const fill = customer.priority_rank === 'P1' ? '#c93636' : customer.priority_rank === 'P2' ? '#e58b27' : '#7751c5'
        const chosen = selectedCustomerId === customer.crl_id
        const number = numbered.get(customer.crl_id)
        const label = number == null ? '•' : String(number)
        const icon = L.divIcon({
          className: '',
          html: `<span style="display:grid;place-items:center;width:${chosen?38:30}px;height:${chosen?38:30}px;background:${fill};border:3px solid white;border-radius:50%;box-shadow:0 3px 12px #4d3c6b66;color:white;font:800 12px sans-serif">${label}</span>`,
          iconSize:[chosen?38:30,chosen?38:30],
          iconAnchor:[chosen?19:15,chosen?19:15],
        })
        const marker = L.marker(pos,{icon}).addTo(map)
        marker.bindPopup(popup(customer, locale))
        marker.on('click', () => selectionRef.current?.(customer.crl_id))
        if (chosen) { map.panTo(pos); marker.openPopup() }
      }
      for (const fat of fatCandidates) {
        const lat = Number(fat.fat_lat)
        const lng = Number(fat.fat_lon)
        if (fat.fat_lat == null || fat.fat_lon == null || !Number.isFinite(lat) || !Number.isFinite(lng) ||
            lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
        const icon = L.divIcon({
          className: '',
          html: '<span style="display:grid;place-items:center;width:19px;height:19px;background:#0d9488;border:2px solid white;transform:rotate(45deg);box-shadow:0 2px 8px #1c454755;color:#fff"></span>',
          iconSize: [19, 19],
          iconAnchor: [10, 10],
        })
        const root = document.createElement('div')
        root.style.cssText = 'min-width:190px;display:grid;gap:5px'
        const name = document.createElement('strong')
        name.textContent = `FAT ${fat.fat_id}`
        root.appendChild(name)
        for (const item of [
          locale === 'id' ? 'Kandidat satu site · koneksi belum terverifikasi' : 'Same-site candidate · connection unverified',
          `${locale === 'id' ? 'Port tersedia' : 'Available ports'}: ${fat.available ?? '—'} / ${fat.capacity ?? '—'}`,
          fat.distance_meters == null ? '' : `${locale === 'id' ? 'Jarak perkiraan' : 'Approx. distance'}: ${fat.distance_meters} m`,
          fat.address || '',
        ]) {
          if (!item) continue
          const line = document.createElement('span')
          line.textContent = item
          root.appendChild(line)
        }
        L.marker([lat, lng], { icon }).addTo(map).bindPopup(root)
      }
      if (agentPosition) {
        const pos: [number, number] = [agentPosition.lat, agentPosition.lng]
        bounds.push(pos)
        const userPopup = document.createElement('span')
        userPopup.textContent = locale === 'id' ? 'Lokasi saya' : 'My location'
        L.circleMarker(pos, { radius: 9, color: '#fff', weight: 2, fillColor: '#1684d8', fillOpacity: 1 })
          .addTo(map).bindPopup(userPopup)
      }
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 })
    }).catch((error: unknown) => {
      if (!stopped) setStatus(error instanceof Error ? error.message : 'Map unavailable')
    })
    return () => { stopped = true; map?.remove() }
  }, [customers, routeStops, selectedCustomerId, agentPosition?.lat, agentPosition?.lng, locale, fatCandidates])
  return (
    <div className="relative h-full w-full">
      <div ref={elementRef} className="h-full w-full" aria-label={locale === 'id' ? 'Peta pin pelanggan' : 'Customer pin map'} />
      {status && <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-base-100 p-3 text-sm text-error shadow">{status}</div>}
    </div>
  )
}
