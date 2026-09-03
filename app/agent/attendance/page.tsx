'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock3, LocateFixed, LogIn, LogOut, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'

 type Attendance = {
  attendance_id: number
  attendance_date: string
  check_in_at: string
  check_out_at: string | null
  check_in_latitude: number | null
  check_in_longitude: number | null
  check_in_accuracy_m: number | null
  check_out_latitude: number | null
  check_out_longitude: number | null
  check_out_accuracy_m: number | null
}

function formatTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function AgentAttendancePage() {
  const supabase = createClient()
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadToday() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { window.location.href = '/login'; return }
    const email = user.email.trim().toLowerCase()
    const { data, error } = await supabase
      .from('agent_attendance')
      .select('*')
      .eq('agent_email', email)
      .eq('attendance_date', new Date().toISOString().slice(0, 10))
      .maybeSingle()
    if (error) setError(error.message)
    else setAttendance(data as Attendance | null)
    setLoading(false)
  }

  useEffect(() => { void loadToday() }, [])

  function getPosition() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('GPS is not supported on this device.'))
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      })
    })
  }

  async function run(action: 'in' | 'out') {
    setSaving(true)
    setError('')
    try {
      const position = await getPosition()
      const fn = action === 'in' ? 'agent_check_in' : 'agent_check_out'
      const { data, error } = await supabase.rpc(fn, {
        p_latitude: position.coords.latitude,
        p_longitude: position.coords.longitude,
        p_accuracy_m: position.coords.accuracy,
      })
      if (error) throw error
      setAttendance(data as Attendance)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save attendance.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className={styles.page}><div className={styles.state}>Loading attendance…</div></main>

  const checkedIn = Boolean(attendance?.check_in_at)
  const checkedOut = Boolean(attendance?.check_out_at)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Field attendance</p>
          <h1>Check In / Check Out</h1>
          <p className={styles.subtitle}><UserRound size={16} /> Record your daily field attendance with GPS.</p>
        </div>
        <Link href="/agent" className={styles.backButton}>Back</Link>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.statusCard}>
        <div className={styles.statusIcon}>{checkedOut ? <CheckCircle2 /> : <Clock3 />}</div>
        <div>
          <span>Today&apos;s status</span>
          <strong>{checkedOut ? 'Completed' : checkedIn ? 'Checked in' : 'Not checked in'}</strong>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}><LogIn size={18} /> Check In</div>
          <strong>{formatTime(attendance?.check_in_at ?? null)}</strong>
          <span>{attendance?.check_in_accuracy_m ? `GPS accuracy ±${attendance.check_in_accuracy_m.toFixed(0)} m` : 'GPS location will be recorded.'}</span>
          <button type="button" disabled={saving || checkedIn} onClick={() => run('in')} className={styles.primaryButton}>
            <LocateFixed size={17} /> {saving && !checkedIn ? 'Saving…' : checkedIn ? 'Checked In' : 'Check In Now'}
          </button>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}><LogOut size={18} /> Check Out</div>
          <strong>{formatTime(attendance?.check_out_at ?? null)}</strong>
          <span>{attendance?.check_out_accuracy_m ? `GPS accuracy ±${attendance.check_out_accuracy_m.toFixed(0)} m` : 'Check in first, then finish your field day here.'}</span>
          <button type="button" disabled={saving || !checkedIn || checkedOut} onClick={() => run('out')} className={styles.secondaryButton}>
            <LocateFixed size={17} /> {saving && checkedIn && !checkedOut ? 'Saving…' : checkedOut ? 'Checked Out' : 'Check Out Now'}
          </button>
        </div>
      </section>

      <div className={styles.note}>Attendance uses your device GPS and records one check-in and one check-out per day.</div>
    </main>
  )
}
