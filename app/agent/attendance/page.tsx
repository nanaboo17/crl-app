'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, CheckCircle2, Clock3, LocateFixed, LogIn, LogOut, RefreshCw, Timer, UserRound, X } from 'lucide-react'
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
type DiagnosticSeverity = 'info' | 'warning' | 'error'

const MIN_WORK_MINUTES = 8 * 60
const ATTENDANCE_TIMEZONE = 'Asia/Jakarta'
const PHOTO_MAX_EDGE = 1280
const PHOTO_QUALITY = 0.72

function attendanceDiagnostic(stage: string, severity: DiagnosticSeverity, message: string, metadata: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('crl-attendance-diagnostic', {
    detail: { stage, severity, message, metadata },
  }))
}

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

function formatStampTime() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ATTENDANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(',', '')
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

async function captureCompressedPhoto(video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  if (!sourceWidth || !sourceHeight) throw new Error('Camera image is not ready yet.')

  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to process camera image.')
  context.drawImage(video, 0, 0, width, height)

  const webp = await canvasBlob(canvas, 'image/webp', PHOTO_QUALITY)
  if (webp?.type === 'image/webp') return webp

  const jpeg = await canvasBlob(canvas, 'image/jpeg', PHOTO_QUALITY)
  if (!jpeg) throw new Error('Unable to compress camera image.')
  return jpeg
}

function loadBlobImage(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Unable to prepare the attendance photo stamp.'))
    }
    image.src = url
  })
}

async function stampAttendancePhoto(
  photo: Blob,
  action: Action,
  position: GeolocationPosition,
  email: string
) {
  const image = await loadBlobImage(photo)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to stamp attendance photo.')

  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const padding = Math.max(14, Math.round(canvas.width * 0.018))
  const titleSize = Math.max(18, Math.round(canvas.width * 0.026))
  const bodySize = Math.max(14, Math.round(canvas.width * 0.019))
  const lineHeight = Math.round(bodySize * 1.45)
  const stampHeight = padding * 2 + titleSize + lineHeight * 3
  const top = Math.max(0, canvas.height - stampHeight)

  context.fillStyle = 'rgba(0, 0, 0, 0.68)'
  context.fillRect(0, top, canvas.width, stampHeight)

  context.textBaseline = 'top'
  context.fillStyle = '#ffffff'
  context.font = `700 ${titleSize}px system-ui, -apple-system, sans-serif`
  context.fillText(action === 'in' ? 'CRL CHECK IN' : 'CRL CHECK OUT', padding, top + padding)

  context.font = `600 ${bodySize}px system-ui, -apple-system, sans-serif`
  const bodyTop = top + padding + titleSize + Math.round(bodySize * 0.4)
  context.fillText(`WIB: ${formatStampTime()}`, padding, bodyTop)
  context.fillText(
    `GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)} ±${Math.round(position.coords.accuracy)}m`,
    padding,
    bodyTop + lineHeight
  )
  context.fillText(`Agent: ${email}`, padding, bodyTop + lineHeight * 2)

  const webp = await canvasBlob(canvas, 'image/webp', PHOTO_QUALITY)
  if (webp?.type === 'image/webp') return webp

  const jpeg = await canvasBlob(canvas, 'image/jpeg', PHOTO_QUALITY)
  if (!jpeg) throw new Error('Unable to save stamped attendance photo.')
  return jpeg
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
  const [photos, setPhotos] = useState<Record<Action, Blob | null>>({ in: null, out: null })
  const [previews, setPreviews] = useState<Record<Action, string>>({ in: '', out: '' })

  async function loadPhoto(path: string | null, action: Action) {
    if (!path) return
    const { data, error } = await supabase.storage.from('attendance-evidence').createSignedUrl(path, 3600)
    if (error) {
      attendanceDiagnostic('attendance_photo_preview', 'warning', error.message, { action, path_exists: Boolean(path) })
      return
    }
    if (data?.signedUrl) setPreviews((current) => ({ ...current, [action]: data.signedUrl }))
  }

  async function loadToday() {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) attendanceDiagnostic('attendance_auth', 'error', authError.message)
    if (!user?.email) { window.location.href = '/login'; return }
    const currentEmail = user.email.trim().toLowerCase()
    setEmail(currentEmail)
    const { data, error } = await supabase
      .from('agent_attendance')
      .select('*')
      .eq('agent_email', currentEmail)
      .eq('attendance_date', localDateKey())
      .maybeSingle()
    if (error) {
      attendanceDiagnostic('attendance_load', 'error', error.message, { attendance_date: localDateKey() })
      setError(error.message)
    } else {
      const row = data as Attendance | null
      setAttendance(row)
      attendanceDiagnostic('attendance_load', 'info', row ? 'Attendance record loaded' : 'No attendance record for today', {
        attendance_date: localDateKey(),
        checked_in: Boolean(row?.check_in_at),
        checked_out: Boolean(row?.check_out_at),
      })
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

  function onPhoto(action: Action, blob: Blob, previewUrl: string) {
    setPhotos((current) => ({ ...current, [action]: blob }))
    setPreviews((current) => ({ ...current, [action]: previewUrl }))
    attendanceDiagnostic('attendance_photo_captured', 'info', 'Attendance photo captured and compressed', {
      action,
      file_type: blob.type,
      file_size_bytes: blob.size,
      max_edge_px: PHOTO_MAX_EDGE,
      quality: PHOTO_QUALITY,
    })
  }

  async function uploadPhoto(action: Action, photo: Blob) {
    if (!email) throw new Error(tx('Agent account is not ready.', 'Akun agen belum siap.'))

    const extension = photo.type === 'image/webp' ? 'webp' : 'jpg'
    const contentType = photo.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const path = `${email}/${localDateKey()}/${action}-${Date.now()}.${extension}`
    attendanceDiagnostic('attendance_photo_upload_start', 'info', 'Uploading stamped compressed attendance photo', {
      action,
      file_type: contentType,
      file_size_bytes: photo.size,
      attendance_date: localDateKey(),
    })

    const { error } = await supabase.storage.from('attendance-evidence').upload(path, photo, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) {
      attendanceDiagnostic('attendance_photo_upload', 'error', error.message, {
        action,
        file_type: contentType,
        file_size_bytes: photo.size,
      })
      throw error
    }
    attendanceDiagnostic('attendance_photo_upload', 'info', 'Stamped compressed attendance photo uploaded', {
      action,
      file_type: contentType,
      file_size_bytes: photo.size,
    })
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
      const message = tx(
        `Minimum work duration is 8 hours. Remaining: ${formatDuration(remainingMinutes, 'en')}.`,
        `Durasi kerja minimum adalah 8 jam. Sisa waktu: ${formatDuration(remainingMinutes, 'id')}.`
      )
      attendanceDiagnostic('attendance_validation', 'warning', message, { action, remaining_minutes: remainingMinutes })
      setError(message)
      return
    }
    const capturedPhoto = photos[action]
    if (!capturedPhoto) {
      setError(action === 'in'
        ? tx('Check-in photo is required.', 'Foto check-in wajib diambil.')
        : tx('Check-out photo is required.', 'Foto check-out wajib diambil.'))
      return
    }

    setSaving(true)
    setError('')
    let photoPath: string | null = null
    attendanceDiagnostic('attendance_action_start', 'info', action === 'in' ? 'Check-in started' : 'Check-out started', {
      action,
      attendance_date: localDateKey(),
      online: navigator.onLine,
    })
    try {
      let position: GeolocationPosition
      try {
        position = await getPosition()
        attendanceDiagnostic('attendance_gps', 'info', 'GPS captured for attendance', {
          action,
          accuracy_m: position.coords.accuracy,
        })
      } catch (gpsError) {
        const message = gpsError instanceof Error ? gpsError.message : 'GPS capture failed'
        attendanceDiagnostic('attendance_gps', 'error', message, {
          action,
          geolocation_code: typeof GeolocationPositionError !== 'undefined' && gpsError instanceof GeolocationPositionError ? gpsError.code : null,
        })
        throw gpsError
      }

      const stampedPhoto = await stampAttendancePhoto(capturedPhoto, action, position, email)
      const stampedPreview = URL.createObjectURL(stampedPhoto)
      setPreviews((current) => ({ ...current, [action]: stampedPreview }))
      attendanceDiagnostic('attendance_photo_stamped', 'info', 'Attendance photo stamped with timestamp and GPS', {
        action,
        file_type: stampedPhoto.type,
        file_size_bytes: stampedPhoto.size,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
      })

      photoPath = await uploadPhoto(action, stampedPhoto)
      const fn = action === 'in' ? 'agent_check_in' : 'agent_check_out'
      attendanceDiagnostic('attendance_rpc_start', 'info', `Calling ${fn}`, { action })
      const { data, error } = await supabase.rpc(fn, {
        p_latitude: position.coords.latitude,
        p_longitude: position.coords.longitude,
        p_accuracy_m: position.coords.accuracy,
        p_photo_path: photoPath,
      })
      if (error) {
        attendanceDiagnostic('attendance_rpc', 'error', error.message, {
          action,
          rpc: fn,
          code: error.code || null,
          details: error.details || null,
          hint: error.hint || null,
          photo_uploaded: Boolean(photoPath),
        })
        throw error
      }
      const row = data as Attendance
      setAttendance(row)
      setPhotos((current) => ({ ...current, [action]: null }))
      attendanceDiagnostic('attendance_saved', 'info', action === 'in' ? 'Check-in saved successfully' : 'Check-out saved successfully', {
        action,
        attendance_id: row.attendance_id,
        attendance_date: row.attendance_date,
        check_in_status: row.check_in_status,
      })
      void loadPhoto(action === 'in' ? row.check_in_photo_path : row.check_out_photo_path, action)
    } catch (err) {
      const message = err instanceof Error ? err.message : tx('Unable to save attendance.', 'Tidak dapat menyimpan absensi.')
      attendanceDiagnostic('attendance_save_failed', 'error', message, {
        action,
        photo_uploaded_before_failure: Boolean(photoPath),
        online: navigator.onLine,
      })
      setError(message)
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
          <p className={styles.subtitle}><UserRound size={16} /> {tx('Direct camera + GPS attendance. Check-in deadline: 08:00 WIB.', 'Absensi kamera langsung + GPS. Batas check-in: 08.00 WIB.')}</p>
        </div>
        <Link href="/agent" className={styles.backButton}>{tx('Back', 'Kembali')}</Link>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}

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
          onPhoto={(blob, url) => onPhoto('in', blob, url)}
          onRun={() => run('in')}
          photoDisabled={checkedIn}
          accuracyLabel={(value) => tx(`GPS accuracy ±${value} m`, `Akurasi GPS ±${value} m`)}
          requirementText={tx('Take a photo directly with the camera. GPS is also required.', 'Ambil foto langsung dari kamera. GPS juga wajib diambil.')}
          photoText={tx('Open camera for check-in', 'Buka kamera untuk check-in')}
          photoAlt={tx('Check-in evidence', 'Bukti check-in')}
          captureText={tx('Capture photo', 'Ambil foto')}
          retakeText={tx('Retake', 'Foto ulang')}
          cancelText={tx('Cancel camera', 'Batalkan kamera')}
          cameraErrorText={tx('Camera access is required. Allow camera permission and try again.', 'Akses kamera wajib. Izinkan kamera lalu coba lagi.')}
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
          onPhoto={(blob, url) => onPhoto('out', blob, url)}
          onRun={() => run('out')}
          photoDisabled={!canCheckOut || checkedOut}
          accuracyLabel={(value) => tx(`GPS accuracy ±${value} m`, `Akurasi GPS ±${value} m`)}
          requirementText={tx('Take a photo directly with the camera. GPS is also required.', 'Ambil foto langsung dari kamera. GPS juga wajib diambil.')}
          photoText={tx('Open camera for check-out', 'Buka kamera untuk check-out')}
          photoAlt={tx('Check-out evidence', 'Bukti check-out')}
          captureText={tx('Capture photo', 'Ambil foto')}
          retakeText={tx('Retake', 'Foto ulang')}
          cancelText={tx('Cancel camera', 'Batalkan kamera')}
          cameraErrorText={tx('Camera access is required. Allow camera permission and try again.', 'Akses kamera wajib. Izinkan kamera lalu coba lagi.')}
        />
      </section>

      <div className={styles.note}>
        {tx('Check-in after 08:00 WIB is marked ', 'Check-in setelah pukul 08.00 WIB akan ditandai ')}
        <strong>{tx('Late', 'Terlambat')}</strong>.
        {' '}{tx('Check-out is unlocked only after at least ', 'Check-out hanya dapat dilakukan setelah minimal ')}
        <strong>{tx('8 hours', '8 jam')}</strong>
        {tx(' from check-in. Photos are captured directly, stamped with WIB time, GPS, and agent identity, compressed to a maximum 1280px edge, and saved as WebP when supported.', ' sejak check-in. Foto diambil langsung, diberi stamp waktu WIB, GPS, dan identitas agen, dikompresi maksimal 1280px, dan disimpan sebagai WebP jika didukung.')}
      </div>
    </main>
  )
}

function AttendanceCard({
  action,
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
  captureText,
  retakeText,
  cancelText,
  cameraErrorText,
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
  onPhoto: (blob: Blob, previewUrl: string) => void
  onRun: () => void
  photoDisabled: boolean
  accuracyLabel: (value: string) => string
  requirementText: string
  photoText: string
  photoAlt: string
  captureText: string
  retakeText: string
  cancelText: string
  cameraErrorText: string
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState('')

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
    setCameraStarting(false)
  }

  useEffect(() => () => stopCamera(), [])

  async function startCamera() {
    if (photoDisabled) return
    setCameraError('')
    setCameraStarting(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error(cameraErrorText)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      })
      streamRef.current = stream
      setCameraOpen(true)
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => undefined)
        }
      })
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : cameraErrorText
      setCameraError(message)
      attendanceDiagnostic('attendance_camera', 'error', message, { action })
      stopCamera()
    } finally {
      setCameraStarting(false)
    }
  }

  async function capture() {
    if (!videoRef.current) return
    try {
      const blob = await captureCompressedPhoto(videoRef.current)
      const url = URL.createObjectURL(blob)
      onPhoto(blob, url)
      attendanceDiagnostic('attendance_camera_capture', 'info', 'Camera photo captured', {
        action,
        file_type: blob.type,
        compressed_size_bytes: blob.size,
      })
      stopCamera()
    } catch (err) {
      const message = err instanceof Error ? err.message : cameraErrorText
      setCameraError(message)
      attendanceDiagnostic('attendance_camera_capture', 'error', message, { action })
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{icon} {title}</div>
      <strong>{time}</strong>
      <span>{accuracy ? accuracyLabel(accuracy.toFixed(0)) : requirementText}</span>

      <div className={`${styles.photoPicker} ${photoDisabled ? styles.photoDisabled : ''}`}>
        {cameraOpen ? (
          <div className={styles.cameraStage}>
            <video ref={videoRef} autoPlay muted playsInline className={styles.photoPreview} aria-label={`${title} camera`} />
            <div className={styles.cameraControls}>
              <button type="button" className={styles.cameraCaptureButton} onClick={() => void capture()}>
                <Camera size={17} /> {captureText}
              </button>
              <button type="button" className={styles.cameraCancelButton} onClick={stopCamera} aria-label={cancelText} title={cancelText}>
                <X size={17} />
              </button>
            </div>
          </div>
        ) : preview ? (
          <button type="button" className={styles.photoButton} onClick={() => void startCamera()} disabled={photoDisabled || cameraStarting}>
            <img src={preview} alt={photoAlt} className={styles.photoPreview} />
            {!photoDisabled && <span className={styles.retakeBadge}><RefreshCw size={14} /> {retakeText}</span>}
          </button>
        ) : (
          <button type="button" className={styles.photoButton} onClick={() => void startCamera()} disabled={photoDisabled || cameraStarting}>
            <div className={styles.photoPlaceholder}>
              <Camera size={24} />
              <span>{cameraStarting ? 'Opening camera…' : photoText}</span>
            </div>
          </button>
        )}
      </div>

      {cameraError && <div className={styles.cameraError}>{cameraError}</div>}

      <button type="button" disabled={disabled} onClick={onRun} className={buttonClass}>
        <LocateFixed size={17} /> {buttonText}
      </button>
    </div>
  )
}
