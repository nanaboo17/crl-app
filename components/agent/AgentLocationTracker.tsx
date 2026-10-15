'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'

const INTERVAL = 30 * 60 * 1000
const RETRY_INTERVAL = 2 * 60 * 1000
const TIMEZONE = 'Asia/Jakarta'
const ATTENDANCE_EVENT = 'crl:attendance-saved'

type Session = { id: string; started_at: string }
type AttendanceEvent = CustomEvent<{ action: 'in' | 'out' }>

function todayWib() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/**
 * No visible agent controls. Attendance is the only shift start/stop mechanism.
 * Browser GPS works only while the site is active; it is not background mobile tracking.
 */
export default function AgentLocationTracker() {
  const supabase = useMemo(() => createClient(), [])
  const userId = useRef<string | null>(null)
  const session = useRef<Session | null>(null)
  const inFlight = useRef(false)
  const syncing = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function endSessions(sessions: Session[]) {
      for (const item of sessions) {
        const { error } = await supabase.from('agent_tracking_sessions')
          .update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', item.id)
        if (error) console.warn('CRL GPS: unable to end tracking session:', error.message)
      }
    }

    async function reconcile(forceStop = false) {
      if (cancelled || syncing.current) return
      syncing.current = true
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id || !user.email || cancelled) return
        userId.current = user.id

        const [{ data: attend, error: attendanceError }, { data: sessions, error: sessionError }] = await Promise.all([
          supabase.from('agent_attendance')
            .select('check_in_at,check_out_at')
            .eq('agent_email', user.email.trim().toLowerCase())
            .eq('attendance_date', todayWib()).maybeSingle(),
          supabase.from('agent_tracking_sessions')
            .select('id,started_at').eq('agent_user_id', user.id)
            .eq('status', 'active').order('started_at', { ascending: false }),
        ])
        if (attendanceError || sessionError || cancelled) {
          console.warn('CRL GPS: unable to read attendance/tracking state:', attendanceError?.message || sessionError?.message)
          return
        }
        const active = (sessions ?? []) as Session[]
        const shouldTrack = !forceStop && Boolean(attend?.check_in_at) && !attend?.check_out_at
        if (!shouldTrack) {
          session.current = null
          if (active.length) await endSessions(active)
          return
        }

        // Keep one session for this attendance day; close anything left from previous days.
        const today = todayWib()
        const current = active.find(s => new Intl.DateTimeFormat('en-CA', {
          timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date(s.started_at)) === today)
        await endSessions(active.filter(s => s.id !== current?.id))
        if (cancelled) return
        if (current) {
          session.current = current
        } else {
          // Successful attendance check-in already required browser GPS permission.
          // Check-in screen explicitly discloses shift-long tracking.
          const now = new Date().toISOString()
          const { data, error } = await supabase.from('agent_tracking_sessions')
            .insert({ agent_user_id: user.id, started_at: now, consent_acknowledged_at: now, status: 'active' })
            .select('id,started_at').single()
          if (error) { console.warn('CRL GPS: unable to start tracking:', error.message); return }
          session.current = data
        }
      } finally { syncing.current = false }
    }

    async function capture() {
      const s = session.current
      if (cancelled || !s || !userId.current || inFlight.current || document.visibilityState !== 'visible') return
      const key = 'crl:gps:next-attempt:' + s.id
      const next = Number(window.localStorage.getItem(key) || 0)
      if (Date.now() < next) return
      window.localStorage.setItem(key, String(Date.now() + RETRY_INTERVAL))
      inFlight.current = true
      let stage: 'capture' | 'upload' = 'capture'
      try {
        if (!navigator.geolocation) throw new Error('Geolocation unsupported')
        // Collect multiple fixes and select the best reported accuracy.
        // This does not force precise GPS on a device configured for approximate location.
        const point = await new Promise<GeolocationPosition>((resolve, reject) => {
          let best: GeolocationPosition | null = null
          let watchId: number | null = null
          let settled = false
          const finish = (error?: GeolocationPositionError) => {
            if (settled) return
            settled = true
            window.clearTimeout(timer)
            if (watchId !== null) navigator.geolocation.clearWatch(watchId)
            if (best) resolve(best)
            else reject(error ?? new Error('No GPS position within 40 seconds'))
          }
          const timer = window.setTimeout(() => finish(), 40000)
          watchId = navigator.geolocation.watchPosition(
            (candidate) => {
              if (!best || candidate.coords.accuracy < best.coords.accuracy) best = candidate
              if (candidate.coords.accuracy <= 50) finish()
            },
            (error) => {
              if (error.code === error.PERMISSION_DENIED) finish(error)
              // Other transient GPS errors are allowed to recover within the window.
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 40000 },
          )
          if (settled && watchId !== null) navigator.geolocation.clearWatch(watchId)
        })
        if (cancelled || session.current?.id !== s.id) return
        stage = 'upload'
        const { error } = await supabase.from('agent_location_history').insert({
          agent_user_id: userId.current,
          tracking_session_id: s.id,
          latitude: point.coords.latitude,
          longitude: point.coords.longitude,
          accuracy_meters: point.coords.accuracy,
          captured_at: new Date(point.timestamp).toISOString(),
          device_event_id: crypto.randomUUID(),
        })
        if (error) throw error
        // Keep low-confidence fixes as evidence, but retry after two minutes.
        window.localStorage.setItem(key, String(Date.now() + (point.coords.accuracy <= 100 ? INTERVAL : RETRY_INTERVAL)))
      } catch (error) {
        console.warn('CRL GPS: capture/upload failed:', error)
        const message = error instanceof Error ? error.message : 'GPS capture/upload failed'
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code ?? 'UNKNOWN') : 'UNKNOWN'
        // Only Superadmins can read diagnostics; never store coordinates in error logs.
        const { error: diagnosticError } = await supabase.from('agent_gps_diagnostics').insert({
          agent_user_id: userId.current, tracking_session_id: s.id,
          stage, error_code: code.slice(0, 80), error_message: message.slice(0, 300),
        })
        if (diagnosticError) console.warn('CRL GPS diagnostic save failed:', diagnosticError.message)
      } finally { inFlight.current = false }
    }

    async function tick() {
      if (cancelled || document.visibilityState !== 'visible') return
      await reconcile()
      if (!cancelled) await capture()
    }

    function attendanceChanged(event: Event) {
      const action = (event as AttendanceEvent).detail?.action
      if (action === 'out') {
        // Stop new captures immediately, even if the database update is delayed.
        session.current = null
        void reconcile(true)
      } else if (action === 'in') {
        void tick()
      }
    }

    void tick()
    const timer = window.setInterval(() => { void tick() }, 60_000)
    const onFocus = () => { void tick() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    window.addEventListener(ATTENDANCE_EVENT, attendanceChanged)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(ATTENDANCE_EVENT, attendanceChanged)
    }
  }, [supabase])

  return null
}
