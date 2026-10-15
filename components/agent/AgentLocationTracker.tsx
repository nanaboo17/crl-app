'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'

const INTERVAL_MS = 30 * 60 * 1000

type TrackingSession = { id: string; started_at: string; status: string }
type Position = { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }

export default function AgentLocationTracker() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => locale === 'id' ? id : en
  const [session, setSession] = useState<TrackingSession | null>(null)
  const [lastCaptured, setLastCaptured] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const supabase = createClient()
  const sessionRef = useRef<TrackingSession | null>(null)
  const lastAttempt = useRef(0)
  const inFlight = useRef(false)
  const running = useRef(true)
  const userId = useRef<string | null>(null)

  useEffect(() => { sessionRef.current = session }, [session])

  const capture = useCallback(async (force = false) => {
    if (!running.current || !sessionRef.current || inFlight.current || !userId.current) return
    const now = Date.now()
    if (!force && now - lastAttempt.current < INTERVAL_MS) return
    lastAttempt.current = now
    inFlight.current = true
    try {
      if (!navigator.geolocation) throw new Error('GPS is not available in this browser.')
      const position: Position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
        })
      })
      if (!running.current || !sessionRef.current) return
      const { error } = await supabase.from('agent_location_history').insert({
        agent_user_id: userId.current,
        tracking_session_id: sessionRef.current.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: position.coords.accuracy,
        captured_at: new Date(position.timestamp).toISOString(),
        device_event_id: crypto.randomUUID(),
      })
      if (error) throw error
      setLastCaptured(new Date(position.timestamp).toISOString())
      setStatus(tx('Location saved.', 'Lokasi tersimpan.'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tx('Unable to collect location.', 'Gagal mengambil lokasi.'))
    } finally {
      inFlight.current = false
    }
  }, [supabase, locale])

  useEffect(() => {
    running.current = true
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      userId.current = user.id
      const { data, error } = await supabase.from('agent_tracking_sessions')
        .select('id, started_at, status')
        .eq('agent_user_id', user.id).eq('status', 'active')
        .order('started_at', { ascending: false }).limit(1).maybeSingle()
      if (cancelled) return
      if (error) setStatus(error.message)
      else if (data) { sessionRef.current = data; setSession(data) }
      setReady(true)
    }
    void load()
    return () => { cancelled = true; running.current = false }
  }, [supabase])

  useEffect(() => {
    if (!session) return
    const maybeCapture = () => { if (document.visibilityState === 'visible') void capture() }
    maybeCapture()
    const timer = window.setInterval(maybeCapture, 60 * 1000)
    document.addEventListener('visibilitychange', maybeCapture)
    window.addEventListener('focus', maybeCapture)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', maybeCapture)
      window.removeEventListener('focus', maybeCapture)
    }
  }, [session, capture])

  const start = async () => {
    if (!userId.current || !navigator.geolocation || !window.isSecureContext) {
      setStatus(tx('HTTPS and location access are required.', 'HTTPS dan akses lokasi diperlukan.'))
      return
    }
    setBusy(true)
    setStatus('')
    try {
      // Permission is requested through the browser before a session is created.
      await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000 }))
      const now = new Date().toISOString()
      const { data, error } = await supabase.from('agent_tracking_sessions')
        .insert({ agent_user_id: userId.current, consent_acknowledged_at: now, started_at: now, status: 'active' })
        .select('id, started_at, status').single()
      if (error) throw error
      sessionRef.current = data
      setSession(data)
      lastAttempt.current = 0
      // The interval effect will request the first tracked fix.
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to start tracking.')
    } finally { setBusy(false) }
  }

  const stop = async () => {
    if (!sessionRef.current) return
    setBusy(true)
    const current = sessionRef.current
    // Prevent any further captures immediately.
    sessionRef.current = null
    const { error } = await supabase.from('agent_tracking_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', current.id)
    if (error) { sessionRef.current = current; setStatus(error.message) }
    else { setSession(null); setStatus(tx('Shift ended; tracking stopped.', 'Shift berakhir; pelacakan berhenti.')) }
    setBusy(false)
  }

  return (
    <section className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm" aria-label={tx('Agent location tracking', 'Pelacakan lokasi agen')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">{tx('Field location tracking', 'Pelacakan lokasi lapangan')}</h2>
          <p className="text-xs text-base-content/60">{tx('While this website is active, GPS is attempted every 30 minutes.', 'Selama situs aktif, GPS dicoba setiap 30 menit.')}</p>
        </div>
        <span className={`dui-badge ${session ? 'dui-badge-success' : 'dui-badge-ghost'}`}>{session ? tx('On duty', 'Bertugas') : tx('Off duty', 'Tidak bertugas')}</span>
      </div>
      <p className="mt-2 text-xs text-base-content/70">{tx('During an active shift, your location, accuracy and capture time are stored for authorized operational monitoring. Stop tracking at any time. A locked phone or closed browser may prevent updates.', 'Selama shift aktif, lokasi, akurasi, dan waktu diambil disimpan untuk pemantauan operasional yang berwenang. Hentikan kapan saja. Ponsel terkunci atau browser tertutup dapat menghentikan pembaruan.')}</p>
      <p className="mt-2 text-xs">{tx('Last successful GPS:', 'GPS terakhir berhasil:')} {lastCaptured ? new Date(lastCaptured).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB') : '—'}</p>
      {status && <p role="status" className="mt-2 text-xs text-base-content/70">{status}</p>}
      <div className="mt-3 flex gap-2">
        {!session ? <button type="button" className="dui-btn dui-btn-primary dui-btn-sm" disabled={!ready || busy} onClick={() => void start()}>{tx('Agree & Start Shift', 'Setuju & Mulai Shift')}</button>
          : <>
              <button type="button" className="dui-btn dui-btn-outline dui-btn-sm" disabled={busy} onClick={() => void capture(true)}>{tx('Update GPS now', 'Perbarui GPS')}</button>
              <button type="button" className="dui-btn dui-btn-error dui-btn-sm" disabled={busy} onClick={() => void stop()}>{tx('End Shift', 'Akhiri Shift')}</button>
            </>}
      </div>
    </section>
  )
}
