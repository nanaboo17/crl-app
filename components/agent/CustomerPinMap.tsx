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

type Props = {
  customers: MapCustomer[]
  agentPosition?: { lat: number; lng: number } | null
  locale: string
}

type LeafletMap = {
  setView: (point: [number, number], zoom: number) => LeafletMap
  fitBounds: (bounds: [number, number][], options?: { padding?: [number, number]; maxZoom?: number }) => void
  remove: () => void
}
type LeafletInstance = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void }
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
  leafletLoading = new Promise((resolve, reject) => {
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

export default function CustomerPinMap({ customers, agentPosition, locale }: Props) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('')
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
      for (const customer of valid) {
        const pos: [number, number] = [Number(customer.given_latitude), Number(customer.given_longitude)]
        bounds.push(pos)
        const fill = customer.priority_rank === 'P1' ? '#c93636' : customer.priority_rank === 'P2' ? '#e58b27' : '#7751c5'
        L.circleMarker(pos, { radius: 9, color: '#fff', weight: 2, fillColor: fill, fillOpacity: 0.95 })
          .addTo(map).bindPopup(popup(customer, locale))
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
  }, [customers, agentPosition?.lat, agentPosition?.lng, locale])
  return (
    <div className="relative h-full w-full">
      <div ref={elementRef} className="h-full w-full" aria-label={locale === 'id' ? 'Peta pin pelanggan' : 'Customer pin map'} />
      {status && <div className="absolute bottom-3 left-3 z-[1000] rounded-lg bg-base-100 p-3 text-sm text-error shadow">{status}</div>}
    </div>
  )
}
