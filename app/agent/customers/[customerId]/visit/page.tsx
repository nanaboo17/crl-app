'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Camera,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  Save,
  UserRound,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './page.module.css'

const LOCATION_LIMIT_METERS = 200
const VISIT_DRAFT_MAX_AGE_MS = 4 * 60 * 60 * 1000
const MAX_PHOTO_DIMENSION = 1600

function normalizePhone(value: string | null | undefined) {
  return (value ?? '').replace(/[^0-9]/g, '')
}

function isValidPhone(value: string) {
  const digits = normalizePhone(value)
  return /^(?:0|62)\d{8,13}$/.test(digits)
}

function formatVisitTimestamp(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')} WIB`
}

export default function VisitPage() {
  const { t, locale } = useI18n()
  const params = useParams()
  const router = useRouter()
  const customerId = decodeURIComponent(params.customerId as string)
  const draftKey = `crl:visit-draft:${customerId}`
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  const [customer, setCustomer] = useState<any>(null)
  const [agent, setAgent] = useState<any>(null)
  const [phoneCorrect, setPhoneCorrect] = useState<boolean | null>(null)
  const [updatedPhone, setUpdatedPhone] = useState('')
  const [visitAddress, setVisitAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [gpsCapturedAt, setGpsCapturedAt] = useState<string | null>(null)
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)
  const [locationMatch, setLocationMatch] = useState<boolean | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [stampedPhoto, setStampedPhoto] = useState<Blob | null>(null)
  const [photoCapturedAt, setPhotoCapturedAt] = useState<string | null>(null)
  const [consentGiven, setConsentGiven] = useState(false)
  const [loading, setLoading] = useState(true)
  const [gettingGps, setGettingGps] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [visitStatusKunjungan, setVisitStatusKunjungan] = useState('')
  const [conversationResult, setConversationResult] = useState('')
  const [approvedOffer, setApprovedOffer] = useState('')
  const [plannedPaymentDate, setPlannedPaymentDate] = useState('')
  const [unpaidReason, setUnpaidReason] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [capturingPhoto, setCapturingPhoto] = useState(false)

  const alternativePhones = useMemo(
    () => [customer?.alternative_phone_1, customer?.alternative_phone_2, customer?.alternative_phone_3]
      .filter((value: string | null | undefined) => normalizePhone(value)),
    [customer]
  )

  useEffect(() => {
    if (conversationResult === 'Sudah melakukan pembayaran') {
      setUnpaidReason('Sudah bayar')
      setPlannedPaymentDate('')
    }
    if (conversationResult === 'Tidak bertemu pelanggan') {
      setApprovedOffer('Belum ada offer yang disetujui')
      setPlannedPaymentDate('')
      setUnpaidReason('')
    }
  }, [conversationResult])

  useEffect(() => {
    const supabase = createClient()
    async function loadPage() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return router.replace('/login')
      const email = user.email.trim().toLowerCase()

      const { data: agentData } = await supabase
        .from('agents')
        .select('email, agent_name, sales_code, role, active')
        .eq('email', email)
        .maybeSingle()
      if (!agentData || !agentData.active || agentData.role !== 'agent') return router.replace('/auth/route')

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', customerId)
        .eq('agent_email', email)
        .maybeSingle()
      if (customerError) {
        setError(customerError.message)
        setLoading(false)
        return
      }
      if (!customerData) {
        setError(t('agent.visit.notFound'))
        setLoading(false)
        return
      }

      const { data: preVisit } = await supabase
        .from('pre_visits')
        .select('previsit_status')
        .eq('customer_id', customerId)
        .eq('agent_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!preVisit || !['Ready for Visit', 'Direct Visit'].includes(preVisit.previsit_status)) {
        setError(t('agent.visit.preVisitRequired'))
        setLoading(false)
        return
      }

      const { data: existingVisit } = await supabase
        .from('visits')
        .select('visit_id')
        .eq('customer_id', customerId)
        .maybeSingle()
      if (existingVisit) {
        try { sessionStorage.removeItem(draftKey) } catch {}
        setError(t('agent.visit.alreadySubmitted'))
        setLoading(false)
        return
      }

      setAgent(agentData)
      setCustomer(customerData)

      let restored = false
      try {
        const raw = sessionStorage.getItem(draftKey)
        if (raw) {
          const draft = JSON.parse(raw)
          const savedAt = Number(draft.savedAt || 0)
          if (savedAt && Date.now() - savedAt <= VISIT_DRAFT_MAX_AGE_MS) {
            if (typeof draft.visitAddress === 'string') setVisitAddress(draft.visitAddress)
            if (typeof draft.latitude === 'number') setLatitude(draft.latitude)
            if (typeof draft.longitude === 'number') setLongitude(draft.longitude)
            if (typeof draft.gpsAccuracy === 'number') setGpsAccuracy(draft.gpsAccuracy)
            if (typeof draft.gpsCapturedAt === 'string') setGpsCapturedAt(draft.gpsCapturedAt)
            if (typeof draft.distanceMeters === 'number') setDistanceMeters(draft.distanceMeters)
            if (typeof draft.locationMatch === 'boolean') setLocationMatch(draft.locationMatch)
            if (typeof draft.phoneCorrect === 'boolean') setPhoneCorrect(draft.phoneCorrect)
            if (typeof draft.updatedPhone === 'string') setUpdatedPhone(draft.updatedPhone)
            if (typeof draft.consentGiven === 'boolean') setConsentGiven(draft.consentGiven)
            if (typeof draft.visitStatusKunjungan === 'string') setVisitStatusKunjungan(draft.visitStatusKunjungan)
            if (typeof draft.conversationResult === 'string') setConversationResult(draft.conversationResult)
            if (typeof draft.approvedOffer === 'string') setApprovedOffer(draft.approvedOffer)
            if (typeof draft.plannedPaymentDate === 'string') setPlannedPaymentDate(draft.plannedPaymentDate)
            if (typeof draft.unpaidReason === 'string') setUnpaidReason(draft.unpaidReason)
            if (typeof draft.additionalNotes === 'string') setAdditionalNotes(draft.additionalNotes)
            restored = true
          } else {
            sessionStorage.removeItem(draftKey)
          }
        }
      } catch {
        // Draft recovery is best-effort only.
      }

      if (!restored) setVisitAddress(customerData.service_address ?? '')
      setDraftRestored(restored)
      setDraftReady(true)
      setLoading(false)
    }
    void loadPage()
  }, [customerId, draftKey, router, t])

  useEffect(() => {
    if (!draftReady) return
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({
        savedAt: Date.now(),
        visitAddress,
        latitude,
        longitude,
        gpsAccuracy,
        gpsCapturedAt,
        distanceMeters,
        locationMatch,
        phoneCorrect,
        updatedPhone,
        consentGiven,
        visitStatusKunjungan,
        conversationResult,
        approvedOffer,
        plannedPaymentDate,
        unpaidReason,
        additionalNotes,
      }))
    } catch {
      // A visit must still work if browser storage is unavailable.
    }
  }, [
    draftReady, draftKey, visitAddress, latitude, longitude, gpsAccuracy, gpsCapturedAt,
    distanceMeters, locationMatch, phoneCorrect, updatedPhone, consentGiven,
    visitStatusKunjungan, conversationResult, approvedOffer, plannedPaymentDate,
    unpaidReason, additionalNotes,
  ])

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
  }, [])

  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000
    const toRad = (value: number) => (value * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  function captureGps() {
    if (latitude !== null || longitude !== null) return
    setError('')
    if (!navigator.geolocation) {
      setError(t('agent.visit.err.gpsNotSupported'))
      return
    }
    setGettingGps(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLat = position.coords.latitude
        const currentLong = position.coords.longitude
        const capturedAt = new Date().toISOString()
        setLatitude(currentLat)
        setLongitude(currentLong)
        setGpsAccuracy(position.coords.accuracy)
        setGpsCapturedAt(capturedAt)
        if (customer?.given_latitude != null && customer?.given_longitude != null) {
          const distance = haversineDistance(Number(customer.given_latitude), Number(customer.given_longitude), currentLat, currentLong)
          setDistanceMeters(distance)
          setLocationMatch(distance <= LOCATION_LIMIT_METERS)
        }
        setGettingGps(false)
      },
      (gpsError) => {
        setError(t('agent.visit.err.gpsFailed', { message: gpsError.message }))
        setGettingGps(false)
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  }

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
    setCameraStarting(false)
  }

  async function startCamera() {
    if (latitude === null || longitude === null || !gpsCapturedAt) {
      setError(t('agent.visit.err.gpsFirstPhoto'))
      return
    }
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(locale === 'id'
        ? 'Kamera di dalam aplikasi tidak didukung oleh browser ini. Gunakan tombol Pilih Foto sebagai alternatif.'
        : 'In-app camera is not supported by this browser. Use Choose Photo as a fallback.')
      return
    }
    setCameraStarting(true)
    try {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      })
      cameraStreamRef.current = stream
      setCameraOpen(true)
      requestAnimationFrame(async () => {
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        try { await videoRef.current.play() } catch {}
      })
    } catch (cameraError) {
      const message = cameraError instanceof Error ? cameraError.message : String(cameraError)
      window.dispatchEvent(new CustomEvent('crl-photo-processing-error', { detail: { message: `Camera start failed: ${message}` } }))
      setError(locale === 'id'
        ? `Kamera tidak dapat dibuka: ${message}. Pastikan izin kamera diberikan.`
        : `Unable to open camera: ${message}. Make sure camera permission is allowed.`)
      stopCamera()
    } finally {
      setCameraStarting(false)
    }
  }

  async function stampImage(file: File, capturedAt: string) {
    if (latitude === null || longitude === null) throw new Error(t('agent.visit.err.gpsBeforePhoto'))

    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error(t('agent.visit.err.cannotProcess'))

      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      const shortSide = Math.min(canvas.width, canvas.height)
      const fontSize = Math.max(22, Math.min(44, Math.round(shortSide * 0.025)))
      const padding = Math.max(20, Math.round(shortSide * 0.018))
      const lineHeight = Math.round(fontSize * 1.4)
      const lines = [
        `Lat: ${latitude.toFixed(7)}`,
        `Lng: ${longitude.toFixed(7)}`,
        `${locale === 'id' ? 'Foto' : 'Photo'}: ${formatVisitTimestamp(capturedAt)}`,
        `${locale === 'id' ? 'Pelanggan' : 'Customer'}: ${customerId}`,
      ]
      const overlayHeight = lineHeight * lines.length + padding * 2
      const y = Math.max(0, canvas.height - overlayHeight)

      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
      ctx.fillRect(0, y, canvas.width, overlayHeight)
      ctx.fillStyle = '#ffffff'
      ctx.font = `600 ${fontSize}px Arial, sans-serif`
      ctx.textBaseline = 'top'

      lines.forEach((line, index) => {
        ctx.fillText(line, padding, y + padding + lineHeight * index, canvas.width - padding * 2)
      })

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(t('agent.visit.err.cannotStamp'))), 'image/jpeg', 0.84)
      })
    } catch (err) {
      if (err instanceof Error) throw err
      throw new Error(t('agent.visit.err.cannotProcess'))
    } finally {
      bitmap?.close()
    }
  }

  async function handlePhoto(selectedFile: File | null) {
    if (!selectedFile) return
    if (latitude === null || longitude === null || !gpsCapturedAt) {
      setError(t('agent.visit.err.gpsFirstPhoto'))
      return
    }
    setError('')
    try {
      const capturedAt = new Date().toISOString()
      const stamped = await stampImage(selectedFile, capturedAt)
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      const nextPreview = URL.createObjectURL(stamped)
      setPhoto(selectedFile)
      setStampedPhoto(stamped)
      setPhotoCapturedAt(capturedAt)
      setPhotoPreview(nextPreview)
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('crl-photo-processing-error', {
        detail: {
          message: err?.message || 'Photo processing failed',
          file_type: selectedFile.type || null,
          file_size_bytes: selectedFile.size,
          max_dimension: MAX_PHOTO_DIMENSION,
        },
      }))
      setError(err.message || t('agent.visit.err.cannotProcess'))
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError(locale === 'id' ? 'Kamera belum siap. Tunggu sebentar lalu coba lagi.' : 'Camera is not ready yet. Wait a moment and try again.')
      return
    }
    setCapturingPhoto(true)
    setError('')
    try {
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error(t('agent.visit.err.cannotProcess'))
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error(t('agent.visit.err.cannotProcess'))), 'image/jpeg', 0.86)
      })
      const file = new File([blob], `visit-${customerId}-${Date.now()}.jpg`, { type: 'image/jpeg' })
      await handlePhoto(file)
      stopCamera()
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('crl-photo-processing-error', { detail: { message: err?.message || 'Camera capture failed' } }))
      setError(err?.message || t('agent.visit.err.cannotProcess'))
    } finally {
      setCapturingPhoto(false)
    }
  }

  async function submitVisit() {
    setError('')
    if (latitude === null || longitude === null || !gpsCapturedAt) return setError(t('agent.visit.err.gpsBeforeSubmit'))
    if (phoneCorrect === null) return setError(locale === 'id' ? 'Mohon konfirmasi apakah nomor telepon terdaftar sudah benar.' : 'Please confirm whether the registered phone number is correct.')
    if (phoneCorrect === false && !isValidPhone(updatedPhone)) return setError(locale === 'id' ? 'Masukkan nomor telepon terbaru yang valid (10–15 digit, diawali 0 atau 62).' : 'Enter a valid updated phone number (10–15 digits, starting with 0 or 62).')
    if (!visitStatusKunjungan) return setError(t('agent.visit.err.selectVisitStatus'))
    if (!conversationResult) return setError(t('agent.visit.err.selectConversation'))
    if (conversationResult !== 'Tidak bertemu pelanggan' && !approvedOffer) return setError(t('agent.visit.err.selectOffer'))
    if (conversationResult === 'Bersedia bayar / Promise to Pay' && !plannedPaymentDate) return setError(t('agent.visit.err.plannedDate'))
    if (
      conversationResult !== 'Sudah melakukan pembayaran' &&
      conversationResult !== 'Tidak bertemu pelanggan' &&
      !unpaidReason
    ) return setError(t('agent.visit.err.unpaidReason'))
    if (!photo || !stampedPhoto || !photoCapturedAt) return setError(t('agent.visit.err.photoRequired'))
    if (!consentGiven) return setError(t('agent.visit.err.consentRequired'))

    setSaving(true)
    const supabase = createClient()
    const correctedPhone = phoneCorrect === false ? normalizePhone(updatedPhone) : null
    const safeCustomerId = customerId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filePath = `${agent.email}/${safeCustomerId}/${Date.now()}-stamped.jpg`

    const { error: uploadError } = await supabase.storage.from('visit-evidence').upload(filePath, stampedPhoto, {
      contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
    })
    if (uploadError) {
      setError(t('agent.visit.err.uploadFailed', { message: uploadError.message }))
      setSaving(false)
      return
    }

    const { error: visitError } = await supabase.from('visits').insert({
      customer_id: customerId,
      agent_email: agent.email,
      sales_code: agent.sales_code,
      visit_result: conversationResult,
      customer_phone: customer.phone_number,
      updated_phone: correctedPhone,
      visit_address: visitAddress.trim() || null,
      latitude,
      longitude,
      gps_accuracy: gpsAccuracy,
      gps_captured_at: gpsCapturedAt,
      distance_to_customer_meters: distanceMeters,
      location_match: locationMatch,
      visit_photo_url: filePath,
      consent_given: consentGiven,
      visit_status_kunjungan: visitStatusKunjungan,
      conversation_result: conversationResult,
      approved_offer: conversationResult === 'Tidak bertemu pelanggan' ? null : (approvedOffer || null),
      planned_payment_date: conversationResult === 'Bersedia bayar / Promise to Pay' ? (plannedPaymentDate || null) : null,
      unpaid_reason:
        conversationResult === 'Sudah melakukan pembayaran' || conversationResult === 'Tidak bertemu pelanggan'
          ? null
          : (unpaidReason || null),
      additional_notes: additionalNotes.trim() || null,
    })
    if (visitError) {
      await supabase.storage.from('visit-evidence').remove([filePath])
      setError(visitError.message)
      setSaving(false)
      return
    }

    const customerUpdate: Record<string, string> = {
      visit_status: 'Visited',
      customer_status: '5. Visited',
      payment_status: conversationResult === 'Sudah melakukan pembayaran' ? 'paid' : 'unpaid',
    }
    if (correctedPhone) customerUpdate.phone_number = correctedPhone

    const { error: customerUpdateError } = await supabase.from('customers').update(customerUpdate).eq('customer_id', customerId)
    if (customerUpdateError) {
      setError(t('agent.visit.err.customerUpdate', { message: customerUpdateError.message }))
      setSaving(false)
      return
    }
    try { sessionStorage.removeItem(draftKey) } catch {}
    stopCamera()
    router.replace(`/agent/customers/${encodeURIComponent(customerId)}`)
    router.refresh()
  }

  if (loading) return <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8"><div className="mx-auto flex justify-center py-20"><span className="dui-loading dui-loading-spinner dui-loading-lg text-primary" /></div></div>

  const gpsCaptured = latitude !== null && longitude !== null
  const backHref = `/agent/customers/${encodeURIComponent(customerId)}`

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-32 sm:p-6 lg:p-8">
      <button type="button" onClick={() => router.push(backHref)} className="dui-btn dui-btn-ghost dui-btn-sm gap-1 px-0">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('agent.visit.backToDetail')}
      </button>

      <SuperadminPageHeader
        breadcrumbs={[
          { label: t('agent.visit.breadcrumbAgent'), href: '/agent', icon: UserRound },
          { label: t('agent.visit.breadcrumbCustomers'), href: '/agent/customers', icon: Building2 },
          { label: t('agent.visit.breadcrumbVisit'), icon: MapPin },
        ]}
        title={t('agent.visit.title')}
        description={t('agent.visit.description')}
      />

      {draftRestored && (
        <div className="dui-alert dui-alert-info">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{locale === 'id' ? 'Data kunjungan sebelumnya dipulihkan setelah halaman dimuat ulang. GPS tidak perlu diambil ulang.' : 'Your visit data was restored after the page reloaded. You do not need to capture GPS again.'}</span>
        </div>
      )}

      <section className="dui-card dui-card-border bg-base-100 shadow-sm">
        <div className="dui-card-body"><div className="flex items-center gap-3"><div className="dui-avatar dui-avatar-placeholder"><div className="w-12 rounded-full bg-primary/10 font-black text-primary">{(customer?.customer_name ?? 'P').slice(0, 2).toUpperCase()}</div></div><div className="min-w-0"><div className="truncate text-lg font-bold">{customer?.customer_name}</div><div className="truncate text-sm text-base-content/60">{customer?.customer_id}</div></div></div></div>
      </section>

      <StepCard t={t} step="1" title={t('agent.visit.step1')}>
        <Field label={t('agent.visit.fieldAddress')}><textarea value={visitAddress} onChange={(e) => setVisitAddress(e.target.value)} className="dui-textarea w-full" rows={3} /></Field>
        <div className="grid grid-cols-2 gap-3"><ReadOnly label={t('agent.visit.givenLat')} value={customer?.given_latitude ?? t('agent.visit.notSet')} /><ReadOnly label={t('agent.visit.givenLon')} value={customer?.given_longitude ?? t('agent.visit.notSet')} /></div>
        {!gpsCaptured ? (
          <button type="button" className="dui-btn dui-btn-primary w-full" onClick={captureGps} disabled={gettingGps}><Navigation className="h-5 w-5" />{gettingGps ? t('agent.visit.gettingGps') : t('agent.visit.captureGps')}</button>
        ) : (
          <>
            <div className="dui-alert dui-alert-success"><CheckCircle2 className="h-5 w-5 shrink-0" /><span>{t('agent.visit.gpsCaptured')}</span></div>
            <div className="grid grid-cols-2 gap-3"><ReadOnly label={t('agent.visit.latitude')} value={latitude?.toFixed(7)} /><ReadOnly label={t('agent.visit.longitude')} value={longitude?.toFixed(7)} /><ReadOnly label={t('agent.visit.accuracy')} value={gpsAccuracy !== null ? t('agent.visit.meterUnit', { value: gpsAccuracy.toFixed(1) }) : '-'} /><ReadOnly label={t('agent.visit.capturedAt')} value={gpsCapturedAt ? formatVisitTimestamp(gpsCapturedAt) : '-'} /></div>
            {distanceMeters !== null && <div className={locationMatch ? 'dui-alert dui-alert-success' : 'dui-alert dui-alert-warning'}>{locationMatch ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}<div><div className="font-semibold">{t('agent.visit.distanceFromAddress')} <span className="font-bold">{t('agent.visit.meterUnitBold', { value: distanceMeters.toFixed(1) })}</span></div><div className="text-sm opacity-80">{locationMatch ? t('agent.visit.locationMatch') : t('agent.visit.locationOutOfRange')}</div></div></div>}
            <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer" className="dui-btn dui-btn-outline w-full"><MapPin className="h-5 w-5" />{t('agent.visit.openInMaps')}</a>
          </>
        )}
      </StepCard>

      <StepCard t={t} step="2" title={t('agent.visit.step2')}>
        <div className="flex items-center gap-2 text-sm font-bold"><Phone className="h-4 w-4" /> {locale === 'id' ? 'Nomor telepon terdaftar' : 'Registered phone'}</div>
        <ReadOnly label={t('agent.visit.fieldCurrentPhone')} value={customer?.phone_number || '-'} />
        {alternativePhones.length > 0 && <div className="grid gap-2 sm:grid-cols-3">{alternativePhones.map((phone: string, index: number) => <ReadOnly key={`${phone}-${index}`} label={locale === 'id' ? `Alternatif ${index + 1}` : `Alternative ${index + 1}`} value={phone} />)}</div>}
        <Field label={locale === 'id' ? 'Apakah nomor telepon terdaftar sudah benar?' : 'Is the registered phone number correct?'}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" className={`dui-btn ${phoneCorrect === true ? 'dui-btn-success' : 'dui-btn-outline'}`} onClick={() => { setPhoneCorrect(true); setUpdatedPhone('') }}><CheckCircle2 className="h-4 w-4" /> {locale === 'id' ? 'Ya, benar' : 'Yes, correct'}</button>
            <button type="button" className={`dui-btn ${phoneCorrect === false ? 'dui-btn-warning' : 'dui-btn-outline'}`} onClick={() => setPhoneCorrect(false)}><AlertTriangle className="h-4 w-4" /> {locale === 'id' ? 'Tidak, perbarui' : 'No, update'}</button>
          </div>
        </Field>
        {phoneCorrect === false && <Field label={t('agent.visit.fieldUpdatedPhone')}><input type="tel" inputMode="tel" value={updatedPhone} onChange={(e) => setUpdatedPhone(e.target.value)} className={`dui-input w-full ${updatedPhone && !isValidPhone(updatedPhone) ? 'dui-input-error' : ''}`} placeholder="08xxxxxxxxxx atau 62xxxxxxxxxxx" />{updatedPhone && <div className={`mt-1 text-xs ${isValidPhone(updatedPhone) ? 'text-success' : 'text-error'}`}>{isValidPhone(updatedPhone) ? (locale === 'id' ? 'Nomor telepon valid' : 'Valid phone number') : (locale === 'id' ? 'Gunakan 10–15 digit diawali 0 atau 62' : 'Use 10–15 digits starting with 0 or 62')}</div>}</Field>}
      </StepCard>

      <StepCard t={t} step="3" title={t('agent.visit.step3')}>
        {!gpsCaptured && <div className="dui-alert dui-alert-warning"><AlertTriangle className="h-5 w-5 shrink-0" /><span>{t('agent.visit.photoGpsWarning')}</span></div>}
        {gpsCaptured && !cameraOpen && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="dui-btn dui-btn-primary w-full" onClick={startCamera} disabled={cameraStarting}>
              <Camera className="h-5 w-5" />
              {cameraStarting ? (locale === 'id' ? 'Membuka kamera…' : 'Opening camera…') : (locale === 'id' ? 'Ambil Foto di Aplikasi' : 'Take Photo In App')}
            </button>
            <label className="dui-btn dui-btn-outline w-full cursor-pointer">
              <Camera className="h-5 w-5" />
              {locale === 'id' ? 'Pilih Foto' : 'Choose Photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)} className="hidden" />
            </label>
          </div>
        )}
        {cameraOpen && (
          <div className="grid gap-3 rounded-box border border-base-300 bg-base-200/40 p-3">
            <video ref={videoRef} autoPlay muted playsInline className="max-h-[68vh] w-full rounded-box bg-black object-cover" />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="dui-btn" onClick={stopCamera} disabled={capturingPhoto}>{locale === 'id' ? 'Batal' : 'Cancel'}</button>
              <button type="button" className="dui-btn dui-btn-primary" onClick={captureFromCamera} disabled={capturingPhoto}>
                {capturingPhoto ? <span className="dui-loading dui-loading-spinner dui-loading-sm" /> : <Camera className="h-5 w-5" />}
                {capturingPhoto ? (locale === 'id' ? 'Memproses…' : 'Processing…') : (locale === 'id' ? 'Gunakan Foto' : 'Use Photo')}
              </button>
            </div>
          </div>
        )}
        {gpsCaptured && <p className="text-xs text-base-content/60">{locale === 'id' ? 'Gunakan “Ambil Foto di Aplikasi” agar halaman tidak berpindah ke aplikasi kamera dan tidak memuat ulang. “Pilih Foto” tersedia sebagai alternatif.' : 'Use “Take Photo In App” so the page stays open instead of switching to the phone camera app. “Choose Photo” is available as a fallback.'}</p>}
        {photoPreview && (
          <div className={styles.photoPreviewCard}>
            <div className={styles.photoFrame}><img src={photoPreview} alt={t('agent.visit.photoAlt')} /></div>
            <div className={styles.photoMeta}>
              <div className={styles.photoMetaTitle}><Camera className="h-4 w-4 shrink-0" />{t('agent.visit.photoStamped')}</div>
              {photoCapturedAt && <div className={styles.photoTime}>{locale === 'id' ? 'Foto diambil' : 'Photo captured'}: {formatVisitTimestamp(photoCapturedAt)}</div>}
            </div>
          </div>
        )}
        <label className="flex cursor-pointer items-start gap-3 rounded-box bg-base-200/60 p-3"><input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} className="dui-checkbox dui-checkbox-primary mt-0.5 shrink-0" /><span className="min-w-0 text-sm leading-relaxed">{t('agent.visit.consentLabel')}</span></label>
      </StepCard>

      <StepCard t={t} step="4" title={t('agent.visit.step4')}>
        <Field label={t('agent.visit.fieldVisitStatus')}><select value={visitStatusKunjungan} onChange={(e) => setVisitStatusKunjungan(e.target.value)} className="dui-select w-full"><option value="">{t('agent.visit.visitStatusPlaceholder')}</option><option value="Bertemu dengan pelanggan">{t('agent.visit.status.met')}</option><option value="Pelanggan tidak ada di tempat">{t('agent.visit.status.notAtPlace')}</option><option value="Alamat tidak ditemukan">{t('agent.visit.status.addressNotFound')}</option><option value="Pelanggan sudah pindah">{t('agent.visit.status.moved')}</option><option value="Tidak berhasil dikunjungi">{t('agent.visit.status.unreachable')}</option><option value="Lainnya">{t('agent.visit.status.other')}</option></select></Field>
        <Field label={t('agent.visit.fieldConversation')}><select value={conversationResult} onChange={(e) => setConversationResult(e.target.value)} className="dui-select w-full"><option value="">{t('agent.visit.conversationPlaceholder')}</option><option value="Sudah melakukan pembayaran">{t('agent.visit.conv.paid')}</option><option value="Bersedia bayar / Promise to Pay">{t('agent.visit.conv.promiseToPay')}</option><option value="Masih mempertimbangkan">{t('agent.visit.conv.stillConsidering')}</option><option value="Tidak bersedia melanjutkan layanan">{t('agent.visit.conv.notWilling')}</option><option value="Tidak bertemu pelanggan">{t('agent.visit.conv.notMet')}</option></select></Field>
      </StepCard>

      {conversationResult !== 'Tidak bertemu pelanggan' && <StepCard t={t} step="5" title={t('agent.visit.step5')}><p className="text-sm text-base-content/60">{t('agent.visit.offerHint')}</p><Field label={t('agent.visit.fieldApprovedOffer')}><select value={approvedOffer} onChange={(e) => setApprovedOffer(e.target.value)} className="dui-select w-full"><option value="">{t('agent.visit.offerPlaceholder')}</option><option value="Diskon 20% selama 3 bulan + Voucher Rp100.000">{t('agent.visit.offer.discount20')}</option><option value="Diskon 30% selama 3 bulan + Voucher Rp100.000">{t('agent.visit.offer.discount30100')}</option><option value="Diskon 30% selama 3 bulan + Voucher Rp200.000">{t('agent.visit.offer.discount30200')}</option><option value="Belum ada offer yang disetujui">{t('agent.visit.offer.none')}</option></select></Field></StepCard>}

      <StepCard t={t} step="6" title={t('agent.visit.step6')}>
        {conversationResult === 'Bersedia bayar / Promise to Pay' && <Field label={t('agent.visit.fieldPlannedDate')}><input type="date" value={plannedPaymentDate} onChange={(e) => setPlannedPaymentDate(e.target.value)} className="dui-input w-full" /></Field>}
        {conversationResult === 'Sudah melakukan pembayaran' ? <div className="dui-alert dui-alert-success"><CheckCircle2 className="h-5 w-5 shrink-0" /><span>{t('agent.visit.paid')}</span></div> : conversationResult !== 'Tidak bertemu pelanggan' ? <Field label={t('agent.visit.fieldUnpaidReason')}><select value={unpaidReason} onChange={(e) => setUnpaidReason(e.target.value)} className="dui-select w-full"><option value="">{t('agent.visit.unpaidPlaceholder')}</option><option value="Masalah keuangan">{t('agent.visit.unpaid.financial')}</option><option value="Harga / tagihan">{t('agent.visit.unpaid.price')}</option><option value="Pindah ke provider lain">{t('agent.visit.unpaid.provider')}</option><option value="Masalah jaringan / layanan">{t('agent.visit.unpaid.network')}</option><option value="Jarang digunakan">{t('agent.visit.unpaid.rarelyUsed')}</option><option value="Pindah alamat">{t('agent.visit.unpaid.movedAddress')}</option><option value="Masalah sales">{t('agent.visit.unpaid.sales')}</option><option value="Alasan pribadi">{t('agent.visit.unpaid.personal')}</option><option value="Lainnya">{t('agent.visit.unpaid.other')}</option></select></Field> : <div className="dui-alert dui-alert-info"><AlertTriangle className="h-5 w-5 shrink-0" /><span>{t('agent.visit.conv.notMet')}</span></div>}
      </StepCard>

      <StepCard t={t} step="7" title={t('agent.visit.step7')}><p className="text-sm text-base-content/60">{t('agent.visit.notesHint')}</p><Field label={t('agent.visit.fieldNotes')}><textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} className="dui-textarea w-full" rows={3} placeholder={t('agent.visit.notesPlaceholder')} /></Field></StepCard>

      {error && <div className="dui-alert dui-alert-error" role="alert"><XCircle className="h-5 w-5 shrink-0" /><span>{error}</span></div>}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 p-3 backdrop-blur"><div className="mx-auto flex max-w-3xl gap-2"><button type="button" className="dui-btn flex-1" onClick={() => { stopCamera(); router.push(backHref) }} disabled={saving}>{t('agent.visit.cancel')}</button><button type="button" className="dui-btn dui-btn-primary flex-1" disabled={saving || cameraOpen} onClick={submitVisit}>{saving ? <><span className="dui-loading dui-loading-spinner dui-loading-sm" />{t('agent.visit.saving')}</> : <><Save className="h-5 w-5" />{t('agent.visit.submit')}</>}</button></div></div>
    </div>
  )
}

function StepCard({ t, step, title, children }: { t: (key: string, params?: Record<string, string | number>) => string; step: string; title: string; children: React.ReactNode }) {
  return <section aria-label={t('agent.visit.stepAria', { step, title })} className="dui-card border border-base-300 bg-base-100 shadow-sm"><div className="dui-card-body gap-4"><h2 className="flex items-center gap-2 text-base font-bold tracking-tight"><span className="dui-badge dui-badge-primary dui-badge-sm">{step}</span>{title}</h2>{children}</div></section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="dui-fieldset"><div className="dui-fieldset-label"><span>{label}</span></div>{children}</div>
}

function ReadOnly({ label, value }: { label: string; value: any }) {
  return <div className="rounded-box bg-base-200/60 px-3 py-2"><div className="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">{label}</div><div className="mt-0.5 break-words text-sm font-semibold">{value === null || value === undefined || value === '' ? '-' : String(value)}</div></div>
}