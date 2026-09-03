'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Camera, CheckCircle2, Clock3, LocateFixed, LogIn, LogOut, Timer, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
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
  check_in_photo_path: string | null
  check_out_photo_path: string | null
  check_in_status: 'on_time' | 'late' | null
  worked_minutes: number | null
}

type Action = 'in' | 'out'

const MIN_WORK_MINUTES = 8 * 60
const ATTENDANCE_TIMEZONE = 'Asia/Jakarta'

function localDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatTime(value: string | null, locale: 'en' | 'id') {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString(locale === 'id' ? 'id-ID' : 'en-GB', {
    timeZone: ATTENDANCE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(minutes: number, locale: 'en' | 'id') {
  const safe = Math.max(0, Math.floor(minutes))
  const hours = Math.floor(safe / 60)
  const mins = safe % 60
  return locale === 'id' ? `${hours} jam ${mins} menit` : `${hours}h ${mins}m`
}

export default function AgentAttendancePage() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const supabase = useMemo(() => createClient(), [])
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [now, setNow] = useState(Date.now())
  const [files, setFiles] = useState<Record<Action, File | null>>({ in: null, out: null })
  const [previews, setPreviews] = useState<Record<Action, string>>({ in: '', out: '' })

  async function loadPhoto(path: string | null, action: Action) {
    if (!path) return
    const { data } = await supabase.storage.from('attendance-evidence').createSignedUrl(path, 3600)
    if (data?.signedUrl) setPreviews((current) => ({ ...current, [action]: data.signedUrl }))
  }

  async function loadToday() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { window.location.href = '/login'; return }
    const currentEmail = user.email.trim().toLowerCase()
    setEmail(currentEmail)
    const { data, error } = await supabase
      .from('agent_attendance')
      .select('*')
      .eq('agent_email', currentEmail)
      .eq('attendance_date', localDateKey())
      .maybeSingle()
    if (error) setError(error.message)
    else {
      const row = data as Attendance | null
      setAttendance(row)
      if (row) {
        void loadPhoto(row.check_in_photo_path, 'in')
        void loadPhoto(row.check_out_photo_path, 'out')
      }
    }
    setLoading(false)
  }

  useEffect(() => { void loadToday() }, [])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  function getPosition() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error(tx('GPS is not supported on this device.', 'GPS tidak didukung pada perangkat ini.')))
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      })
    })
  }

  function onPhoto(action: Action, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setFiles((current) => ({ ...current, [action]: file }))
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviews((current) => ({ ...current, [action]: url }))
    }
  }

  async function uploadPhoto(action: Action) {
    const file = files[action]
    if (!file) {
      throw new Error(action === 'in'
        ? tx('Check-in photo is required.', 'Foto check-in wajib diambil.')
        : tx('Check-out photo is required.', 'Foto check-out wajib diambil.'))
    }
    if (!email) throw new Error(tx('Agent account is not ready.', 'Akun agen belum siap.'))
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${email}/${localDateKey()}/${action}-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from('attendance-evidence').upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })
    if (error) throw error
    return path
  }

  const checkedIn = Boolean(attendance?.check_in_at)
  const checkedOut = Boolean(attendance?.check_out_at)
  const elapsedMinutes = attendance?.check_in_at
    ? Math.floor((now - new Date(attendance.check_in_at).getTime()) / 60000)
    : 0
  const remainingMinutes = Math.max(0, MIN_WORK_MINUTES - elapsedMinutes)
  const canCheckOut = checkedIn && !checkedOut && remainingMinutes === 0

  async function run(action: Action) {
    if (action === 'out' && !canCheckOut) {
      setError(tx(
        `Minimum work duration is 8 hours. Remaining: ${formatDuration(remainingMinutes, 'en')}.`,
        `Durasi kerja minimum adalah 8 jam. Sisa waktu: ${formatDuration(remainingMinutes, 'id')}.`
      ))
      return
    }
    setSaving(true)
    setError('')
    try {
      const position = await getPosition()
      const photoPath = await uploadPhoto(action)
      const fn = action === 'in' ? 'agent_check_in' : 'agent_check_out'
      const { data, error } = await supabase.rpc(fn, {
        p_latitude: position.coords.latitude,
        p_longitude: position.coords.longitude,
        p_accuracy_m: position.coords.accuracy,
        p_photo_path: photoPath,
      })
      if (error) throw error
      const row = data as Attendance
      setAttendance(row)
      setFiles((current) => ({ ...current, [action]: null }))
      void loadPhoto(action === 'in' ? row.check_in_photo_path : row.check_out_photo_path, action)
    } catch (err) {
      setError(err instanceof Error ? err.message : tx('Unable to save attendance.', 'Tidak dapat menyimpan absensi.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className={styles.page}><div className={styles.state}>{tx('Loading attendance…', 'Memuat absensi…')}</div></main>

  const finalDuration = attendance?.worked_minutes ?? (checkedIn ? elapsedMinutes : 0)
  const localeCode = locale === 'id' ? 'id' : 'en'

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{tx('Field attendance', 'Absensi Lapangan')}</p>
          <h1>{tx('Check In / Check Out', 'Check In / Check Out')}</h1>
          <p className={styles.subtitle}><UserRound size={16} /> {tx('Photo + GPS attendance. Check-in deadline: 08:00 WIB.', 'Absensi menggunakan foto + GPS. Batas check-in: 08.00 WIB.')}</p>
        </div>
        <Link href="/agent" className={styles.backButton}>{tx('Back', 'Kembali')}</Link>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.statusCard}>
        <div className={styles.statusIcon}>{checkedOut ? <CheckCircle2 /> : <Clock3 />}</div>
        <div className={styles.statusCopy}>
          <span>{tx("Today's status", 'Status hari ini')}</span>
          <strong>{checkedOut ? tx('Completed', 'Selesai') : checkedIn ? tx('Checked in', 'Sudah check-in') : tx('Not checked in', 'Belum check-in')}</strong>
          {attendance?.check_in_status && (
            <span className={`${styles.punctuality} ${attendance.check_in_status === 'on_time' ? styles.onTime : styles.late}`}>
              {attendance.check_in_status === 'on_time' ? tx('On time', 'Tepat waktu') : tx('Late', 'Terlambat')}
            </span>
          )}
        </div>
        {checkedIn && (
          <div className={styles.durationBox}>
            <Timer size={18} />
            <div><span>{tx('Work duration', 'Durasi kerja')}</span><strong>{formatDuration(finalDuration, localeCode)}</strong></div>
          </div>
        )}
      </section>

      <section className={styles.grid}>
        <AttendanceCard
          action="in"
          title="Check In"
          icon={<LogIn size={18} />}
          time={formatTime(attendance?.check_in_at ?? null, localeCode)}
          accuracy={attendance?.check_in_accuracy_m ?? null}
          preview={previews.in}
          disabled={saving || checkedIn}
          buttonText={saving && !checkedIn ? tx('Saving…', 'Menyimpan…') : checkedIn ? tx('Checked In', 'Sudah Check In') : tx('Check In Now', 'Check In Sekarang')}
          buttonClass={styles.primaryButton}
          onPhoto={(event) => onPhoto('in', event)}
          onRun={() => run('in')}
          photoDisabled={checkedIn}
          accuracyLabel={(value) => tx(`GPS accuracy ±${value} m`, `Akurasi GPS ±${value} m`)}
          requirementText={tx('Photo and GPS location are required.', 'Foto dan lokasi GPS wajib diambil.')}
          photoText={tx('Take check-in photo', 'Ambil foto check-in')}
          photoAlt={tx('Check-in evidence', 'Bukti check-in')}
        />

        <AttendanceCard
          action="out"
          title="Check Out"
          icon={<LogOut size={18} />}
          time={formatTime(attendance?.check_out_at ?? null, localeCode)}
          accuracy={attendance?.check_out_accuracy_m ?? null}
          preview={previews.out}
          disabled={saving || !canCheckOut || checkedOut}
          buttonText={saving && canCheckOut && !checkedOut
            ? tx('Saving…', 'Menyimpan…')
            : checkedOut
              ? tx('Checked Out', 'Sudah Check Out')
              : canCheckOut
                ? tx('Check Out Now', 'Check Out Sekarang')
                : tx(`Available in ${formatDuration(remainingMinutes, 'en')}`, `Tersedia dalam ${formatDuration(remainingMinutes, 'id')}`)}
          buttonClass={styles.secondaryButton}
          onPhoto={(event) => onPhoto('out', event)}
          onRun={() => run('out')}
          photoDisabled={!canCheckOut || checkedOut}
          accuracyLabel={(value) => tx(`GPS accuracy ±${value} m`, `Akurasi GPS ±${value} m`)}
          requirementText={tx('Photo and GPS location are required.', 'Foto dan lokasi GPS wajib diambil.')}
          photoText={tx('Take check-out photo', 'Ambil foto check-out')}
          photoAlt={tx('Check-out evidence', 'Bukti check-out')}
        />
      </section>

      <div className={styles.note}>
        {tx('Check-in after 08:00 WIB is marked ', 'Check-in setelah pukul 08.00 WIB akan ditandai ')}
        <strong>{tx('Late', 'Terlambat')}</strong>.
        {' '}{tx('Check-out is unlocked only after at least ', 'Check-out hanya dapat dilakukan setelah minimal ')}
        <strong>{tx('8 hours', '8 jam')}</strong>
        {tx(' from check-in. Both actions require a photo and GPS.', ' sejak check-in. Kedua proses wajib menggunakan foto dan GPS.')}
      </div>
    </main>
  )
}

function AttendanceCard({
  title,
  icon,
  time,
  accuracy,
  preview,
  disabled,
  buttonText,
  buttonClass,
  onPhoto,
  onRun,
  photoDisabled,
  accuracyLabel,
  requirementText,
  photoText,
  photoAlt,
}: {
  action: Action
  title: string
  icon: React.ReactNode
  time: string
  accuracy: number | null
  preview: string
  disabled: boolean
  buttonText: string
  buttonClass: string
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void
  onRun: () => void
  photoDisabled: boolean
  accuracyLabel: (value: string) => string
  requirementText: string
  photoText: string
  photoAlt: string
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{icon} {title}</div>
      <strong>{time}</strong>
      <span>{accuracy ? accuracyLabel(accuracy.toFixed(0)) : requirementText}</span>

      <label className={`${styles.photoPicker} ${photoDisabled ? styles.photoDisabled : ''}`}>
        <input type="file" accept="image/*" capture="environment" onChange={onPhoto} disabled={photoDisabled} />
        {preview
          ? <img src={preview} alt={photoAlt} className={styles.photoPreview} />
          : <div className={styles.photoPlaceholder}><Camera size={24} /><span>{photoText}</span></div>}
      </label>

      <button type="button" disabled={disabled} onClick={onRun} className={buttonClass}>
        <LocateFixed size={17} /> {buttonText}
      </button>
    </div>
  )
}
