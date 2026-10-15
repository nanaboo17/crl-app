'use client'
import { useEffect, useRef, useState } from 'react'

export type HistoryPoint = { latitude: number; longitude: number; accuracy_meters: number | null; captured_at: string }
type MapInstance = { setView: (a:[number,number],z:number)=>MapInstance; fitBounds:(p:[number,number][],o?:object)=>void; remove:()=>void }
type Marker = { addTo:(map:MapInstance)=>Marker; bindPopup:(element:HTMLElement)=>void }
type Leaflet = { map:(el:HTMLElement,opts?:object)=>MapInstance; tileLayer:(url:string,o:object)=>{addTo:(m:MapInstance)=>void}; polyline:(points:[number,number][],o:object)=>{addTo:(m:MapInstance)=>void}; circleMarker:(point:[number,number],o:object)=>Marker }
declare global { interface Window { CRLTrackingLeaflet?: Leaflet } }
const URL_JS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const URL_CSS='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
let loading:Promise<Leaflet>|null=null
function load():Promise<Leaflet>{
  if(window.CRLTrackingLeaflet) return Promise.resolve(window.CRLTrackingLeaflet)
  if(loading)return loading
  loading=new Promise<Leaflet>((resolve,reject)=>{
    if(!document.querySelector('link[data-crl-gps-leaflet]')){
      const link=document.createElement('link');link.rel='stylesheet';link.href=URL_CSS;link.dataset.crlGpsLeaflet='true';document.head.appendChild(link)
    }
    const script=document.createElement('script');script.src=URL_JS;script.async=true
    script.onload=()=>{const L=(window as Window & {L?:Leaflet}).L;if(L){window.CRLTrackingLeaflet=L;resolve(L)}else reject(new Error('Map library failed to load'))}
    script.onerror=()=>reject(new Error('Unable to load map library'))
    document.head.appendChild(script)
  }).catch(e=>{loading=null;throw e})
  return loading
}
export default function AgentMovementMap({points,locale}:{points:HistoryPoint[];locale:string}){
  const root=useRef<HTMLDivElement>(null)
  const [error,setError]=useState('')
  useEffect(()=>{
    if(!root.current||!points.length)return
    let disposed=false;let map:MapInstance|null=null
    void load().then(L=>{
      if(disposed||!root.current)return
      const coords: [number,number][]=points.map(p=>[p.latitude,p.longitude])
      map=L.map(root.current,{scrollWheelZoom:false}).setView(coords[0],14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map)
      // Connect only contiguous, accurate readings; never bridge an unreliable fix.
      let segment: [number,number][] = []
      const draw = () => { if(segment.length>1)L.polyline(segment,{color:'#6944b5',weight:4,opacity:.85}).addTo(map!) }
      points.forEach((p,i)=>{
        if(p.accuracy_meters != null && p.accuracy_meters <= 100) segment.push(coords[i])
        else { draw(); segment=[] }
      })
      draw()
      points.forEach((p,i)=>{
        const dot=L.circleMarker(coords[i],{radius:i===0||i===points.length-1?10:7,color:'#fff',weight:2,fillColor:p.accuracy_meters == null || p.accuracy_meters > 100?'#e58b27':i===0?'#1684d8':i===points.length-1?'#c93636':'#7751c5',fillOpacity:1}).addTo(map!)
        const info=document.createElement('div');info.style.cssText='min-width:165px;display:grid;gap:5px'
        const title=document.createElement('strong');title.textContent=(i===0?'Start':i===points.length-1?'Latest':'Point '+(i+1));info.appendChild(title)
        for(const line of [new Date(p.captured_at).toLocaleString(locale==='id'?'id-ID':'en-GB',{timeZone:'Asia/Jakarta',hour12:false})+' WIB',p.latitude.toFixed(6)+', '+p.longitude.toFixed(6),'Accuracy: '+(p.accuracy_meters==null?'—':Math.round(p.accuracy_meters)+' m'),(p.accuracy_meters==null||p.accuracy_meters>100?'Low accuracy — excluded from trusted line':'Accepted for trusted movement line')]){
          const div=document.createElement('span');div.textContent=line;info.appendChild(div)
        }
        dot.bindPopup(info)
      })
      map.fitBounds(coords,{padding:[30,30],maxZoom:16})
    }).catch(e=>{if(!disposed)setError(e instanceof Error?e.message:'Map unavailable')})
    return ()=>{disposed=true;map?.remove()}
  },[points,locale])
  return <div className="relative h-96 w-full"><div ref={root} className="h-full w-full" aria-label={locale==='id'?'Peta pergerakan agen':'Agent movement map'}/>{error&&<p role="alert" className="absolute bottom-2 left-2 z-[1000] rounded bg-base-100 p-2 text-sm text-error">{error}</p>}</div>
}
