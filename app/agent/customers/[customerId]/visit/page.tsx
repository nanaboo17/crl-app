'use client'

import { useEffect, useState } from 'react'
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

const LOCATION_LIMIT_METERS = 200

export default function VisitPage() {
  const { t } = useI18n()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const customerId = decodeURIComponent(params.customerId as string)

  const [customer, setCustomer] = useState<any>(null)
  const [agent, setAgent] = useState<any>(null)

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

  useEffect(() => {
    if (conversationResult === 'Sudah melakukan pembayaran') {
      setUnpaidReason('Sudah bayar')
      setPlannedPaymentDate('')
    }

    if (conversationResult === 'Tidak bertemu pelanggan') {
      setApprovedOffer('Belum ada offer yang disetujui')
      setPlannedPaymentDate('')
    }
  }, [conversationResult])

  useEffect(() => {
    async function loadPage() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.email) {
        router.replace('/login')
        return
      }

      const email = user.email.trim().toLowerCase()

      const { data: agentData } = await supabase
        .from('agents')
        .select('email, agent_name, sales_code, role, active')
        .eq('email', email)
        .maybeSingle()

      if (!agentData || !agentData.active || agentData.role !== 'agent') {
        router.replace('/auth/route')
        return
      }

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select(`*, given_latitude, given_longitude`)
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
        .maybeSingle()

      if (!preVisit || preVisit.previsit_status !== 'Ready for Visit') {
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
        setError(t('agent.visit.alreadySubmitted'))
        setLoading(false)
        return
      }

      setAgent(agentData)
      setCustomer(customerData)
      setUpdatedPhone(customerData.phone_number ?? '')
      setVisitAddress(customerData.service_address ?? '')

      setLoading(false)
    }

    loadPage()
  }, [customerId, supabase])

  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000
    const toRad = (value: number) => (value * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  function captureGps() {
    if (latitude !== null || longitude !== null) {
      return
    }

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

        setLatitude(currentLat)
        setLongitude(currentLong)
        setGpsAccuracy(position.coords.accuracy)

        const capturedAt = new Date().toISOString()
        setGpsCapturedAt(capturedAt)

        if (
          customer?.given_latitude !== null &&
          customer?.given_latitude !== undefined &&
          customer?.given_longitude !== null &&
          customer?.given_longitude !== undefined
        ) {
          const distance = haversineDistance(
            Number(customer.given_latitude),
            Number(customer.given_longitude),
            currentLat,
            currentLong
          )
          setDistanceMeters(distance)
          setLocationMatch(distance <= LOCATION_LIMIT_METERS)
        }

        setGettingGps(false)
      },
      (gpsError) => {
        setError(t('agent.visit.err.gpsFailed', { message: gpsError.message }))
        setGettingGps(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    )
  }

  async function stampImage(file: File) {
    if (latitude === null || longitude === null || !gpsCapturedAt) {
      throw new Error(t('agent.visit.err.gpsBeforePhoto'))
    }

    return new Promise<Blob>((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error(t('agent.visit.err.cannotProcess')))
          return
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

        const fontSize = Math.max(26, Math.round(canvas.width * 0.028))
        const padding = Math.max(20, Math.round(canvas.width * 0.02))
        const lineHeight = fontSize * 1.35
        const overlayHeight = lineHeight * 4 + padding * 2

        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
        ctx.fillRect(0, canvas.height - overlayHeight, canvas.width, overlayHeight)
        ctx.fillStyle = '#ffffff'
        ctx.font = `600 ${fontSize}px Arial`

        const timestamp = new Date(gpsCapturedAt).toLocaleString('id-ID')
        const lines = [
          `Latitude: ${latitude.toFixed(7)}`,
          `Longitude: ${longitude.toFixed(7)}`,
          `Timestamp: ${timestamp}`,
          `Customer ID: ${customerId}`,
        ]

        lines.forEach((line, index) => {
          ctx.fillText(line, padding, canvas.height - overlayHeight + padding + lineHeight * (index + 1))
        })

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error(t('agent.visit.err.cannotStamp')))
              return
            }
            resolve(blob)
          },
          'image/jpeg',
          0.88
        )
      }
      image.onerror = () => {
        reject(new Error(t('agent.visit.err.cannotLoad')))
      }
      image.src = URL.createObjectURL(file)
    })
  }

  async function handlePhoto(selectedFile: File | null) {
    if (!selectedFile) {
      return
    }

    if (latitude === null || longitude === null || !gpsCapturedAt) {
      setError(t('agent.visit.err.gpsFirstPhoto'))
      return
    }

    setError('')

    try {
      const stamped = await stampImage(selectedFile)
      setPhoto(selectedFile)
      setStampedPhoto(stamped)
      setPhotoPreview(URL.createObjectURL(stamped))
    } catch (err: any) {
      setError(err.message || t('agent.visit.err.cannotProcess'))
    }
  }

  async function submitVisit() {
    setError('')

    if (latitude === null || longitude === null || !gpsCapturedAt) {
      setError(t('agent.visit.err.gpsBeforeSubmit'))
      return
    }

    if (!visitStatusKunjungan) {
      setError(t('agent.visit.err.selectVisitStatus'))
      return
    }

    if (!conversationResult) {
      setError(t('agent.visit.err.selectConversation'))
      return
    }

    if (conversationResult !== 'Tidak bertemu pelanggan' && !approvedOffer) {
      setError(t('agent.visit.err.selectOffer'))
      return
    }

    if (conversationResult === 'Bersedia bayar / Promise to Pay' && !plannedPaymentDate) {
      setError(t('agent.visit.err.plannedDate'))
      return
    }

    if (conversationResult !== 'Sudah melakukan pembayaran' && !unpaidReason) {
      setError(t('agent.visit.err.unpaidReason'))
      return
    }

    if (!photo || !stampedPhoto) {
      setError(t('agent.visit.err.photoRequired'))
      return
    }

    if (!consentGiven) {
      setError(t('agent.visit.err.consentRequired'))
      return
    }

    setSaving(true)

    const safeCustomerId = customerId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filePath = `${agent.email}/${safeCustomerId}/${Date.now()}-stamped.jpg`

    const { error: uploadError } = await supabase.storage
      .from('visit-evidence')
      .upload(filePath, stampedPhoto, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
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
      updated_phone: updatedPhone.trim() || null,
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
      approved_offer: approvedOffer,
      planned_payment_date: plannedPaymentDate || null,
      unpaid_reason: unpaidReason,
      additional_notes: additionalNotes.trim() || null,
    })

    if (visitError) {
      await supabase.storage.from('visit-evidence').remove([filePath])
      setError(visitError.message)
      setSaving(false)
      return
    }

    const nextPaymentStatus =
      conversationResult === 'Sudah melakukan pembayaran' ? 'paid' : 'unpaid'

    const { error: customerUpdateError } = await supabase
      .from('customers')
      .update({
        visit_status: 'Visited',
        customer_status: '5. Visited',
        payment_status: nextPaymentStatus,
      })
      .eq('customer_id', customerId)

    if (customerUpdateError) {
      setError(t('agent.visit.err.customerUpdate', { message: customerUpdateError.message }))
      setSaving(false)
      return
    }

    router.replace(`/agent/customers/${encodeURIComponent(customerId)}`)
    router.refresh()
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex justify-center py-20">
          <span className="dui-loading dui-loading-spinner dui-loading-lg text-primary" />
        </div>
      </div>
    )
  }

  const gpsCaptured = latitude !== null && longitude !== null

  const backHref = `/agent/customers/${encodeURIComponent(customerId)}`

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6 lg:p-8 pb-32">
      <button type="button" onClick={() => router.push(backHref)} className="dui-btn dui-btn-ghost dui-btn-sm gap-1 px-0">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('agent.visit.backToDetail')}
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

      <section className="dui-card dui-card-border bg-base-100 shadow-sm">
        <div className="dui-card-body">
          <div className="flex items-center gap-3">
            <div className="dui-avatar dui-avatar-placeholder">
              <div className="w-12 rounded-full bg-primary/10 text-primary font-black">
                {(customer?.customer_name ?? 'P').slice(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-base-content">
                {customer?.customer_name}
              </div>
              <div className="truncate text-sm text-base-content/60">{customer?.customer_id}</div>
            </div>
          </div>
        </div>
      </section>

      <StepCard t={t} step="1" title={t('agent.visit.step1')}>
        <Field label={t('agent.visit.fieldAddress')}>
          <textarea
            value={visitAddress}
            onChange={(e) => setVisitAddress(e.target.value)}
            className="dui-textarea w-full"
            rows={3}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <ReadOnly label={t('agent.visit.givenLat')} value={customer?.given_latitude ?? t('agent.visit.notSet')} />
          <ReadOnly label={t('agent.visit.givenLon')} value={customer?.given_longitude ?? t('agent.visit.notSet')} />
        </div>

        {!gpsCaptured ? (
          <button
            type="button"
            className="dui-btn dui-btn-primary w-full"
            onClick={captureGps}
            disabled={gettingGps}
          >
            <Navigation className="h-5 w-5" aria-hidden="true" />
            {gettingGps ? t('agent.visit.gettingGps') : t('agent.visit.captureGps')}
          </button>
        ) : (
          <>
            <div className="dui-alert dui-alert-success">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{t('agent.visit.gpsCaptured')}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ReadOnly label={t('agent.visit.latitude')} value={latitude?.toFixed(7)} />
              <ReadOnly label={t('agent.visit.longitude')} value={longitude?.toFixed(7)} />
              <ReadOnly label={t('agent.visit.accuracy')} value={gpsAccuracy !== null ? t('agent.visit.meterUnit', { value: gpsAccuracy.toFixed(1) }) : '-'} />
              <ReadOnly label={t('agent.visit.capturedAt')} value={gpsCapturedAt ? new Date(gpsCapturedAt).toLocaleString('id-ID') : '-'} />
            </div>

            {distanceMeters !== null && (
              <div className={locationMatch ? 'dui-alert dui-alert-success' : 'dui-alert dui-alert-warning'}>
                {locationMatch ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                )}
                <div>
                  <div className="font-semibold">{t('agent.visit.distanceFromAddress')} <span className="font-bold">{t('agent.visit.meterUnitBold', { value: distanceMeters.toFixed(1) })}</span></div>
                  <div className="text-sm opacity-80">
                    {locationMatch
                      ? t('agent.visit.locationMatch')
                      : t('agent.visit.locationOutOfRange')}
                  </div>
                </div>
              </div>
            )}

            <div className="aspect-video w-full overflow-hidden rounded-box border border-base-300">
              <iframe
                title={t('agent.visit.mapTitle')}
                src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=17&output=embed`}
                loading="lazy"
                className="h-full w-full border-0"
              />
            </div>

            <a
              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
              target="_blank"
              rel="noreferrer"
              className="dui-btn dui-btn-outline w-full"
            >
              <MapPin className="h-5 w-5" aria-hidden="true" />
              {t('agent.visit.openInMaps')}
            </a>
          </>
        )}
      </StepCard>

      <StepCard t={t} step="2" title={t('agent.visit.step2')}>
        <Field label={t('agent.visit.fieldCurrentPhone')}>
          <input value={customer?.phone_number ?? ''} disabled className="dui-input w-full opacity-60" />
        </Field>
        <Field label={t('agent.visit.fieldUpdatedPhone')}>
          <input
            type="tel"
            value={updatedPhone}
            onChange={(e) => setUpdatedPhone(e.target.value)}
            className="dui-input w-full"
          />
        </Field>
      </StepCard>

      <StepCard t={t} step="3" title={t('agent.visit.step3')}>
        {!gpsCaptured && (
          <div className="dui-alert dui-alert-warning">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{t('agent.visit.photoGpsWarning')}</span>
          </div>
        )}

        <Field label={t('agent.visit.fieldPhoto')}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={!gpsCaptured}
            onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
            className="dui-file-input w-full"
          />
        </Field>

        {photoPreview && (
          <figure className="overflow-hidden rounded-box border border-base-300">
            <img src={photoPreview} alt={t('agent.visit.photoAlt')} className="w-full" />
            <figcaption className="flex items-center gap-2 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {t('agent.visit.photoStamped')}
            </figcaption>
          </figure>
        )}

        <label className="flex cursor-pointer items-center gap-3 rounded-box bg-base-200/60 p-3">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="dui-checkbox dui-checkbox-primary"
          />
          <span className="text-sm text-base-content">
            {t('agent.visit.consentLabel')}
          </span>
        </label>
      </StepCard>

      <StepCard t={t} step="4" title={t('agent.visit.step4')}>
        <Field label={t('agent.visit.fieldVisitStatus')}>
          <select value={visitStatusKunjungan} onChange={(e) => setVisitStatusKunjungan(e.target.value)} className="dui-select w-full">
            <option value="">{t('agent.visit.visitStatusPlaceholder')}</option>
            <option value="Bertemu dengan pelanggan">{t('agent.visit.status.met')}</option>
            <option value="Pelanggan tidak ada di tempat">{t('agent.visit.status.notAtPlace')}</option>
            <option value="Alamat tidak ditemukan">{t('agent.visit.status.addressNotFound')}</option>
            <option value="Pelanggan sudah pindah">{t('agent.visit.status.moved')}</option>
            <option value="Tidak berhasil dikunjungi">{t('agent.visit.status.unreachable')}</option>
            <option value="Lainnya">{t('agent.visit.status.other')}</option>
          </select>
        </Field>

        <Field label={t('agent.visit.fieldConversation')}>
          <select value={conversationResult} onChange={(e) => setConversationResult(e.target.value)} className="dui-select w-full">
            <option value="">{t('agent.visit.conversationPlaceholder')}</option>
            <option value="Sudah melakukan pembayaran">{t('agent.visit.conv.paid')}</option>
            <option value="Bersedia bayar / Promise to Pay">{t('agent.visit.conv.promiseToPay')}</option>
            <option value="Masih mempertimbangkan">{t('agent.visit.conv.stillConsidering')}</option>
            <option value="Tidak bersedia melanjutkan layanan">{t('agent.visit.conv.notWilling')}</option>
            <option value="Tidak bertemu pelanggan">{t('agent.visit.conv.notMet')}</option>
          </select>
        </Field>
      </StepCard>

      {conversationResult !== 'Tidak bertemu pelanggan' && (
        <StepCard t={t} step="5" title={t('agent.visit.step5')}>
          <p className="text-sm text-base-content/60">
            {t('agent.visit.offerHint')}
          </p>
          <Field label={t('agent.visit.fieldApprovedOffer')}>
            <select value={approvedOffer} onChange={(e) => setApprovedOffer(e.target.value)} className="dui-select w-full">
              <option value="">{t('agent.visit.offerPlaceholder')}</option>
              <option value="Diskon 20% selama 3 bulan + Voucher Rp100.000">{t('agent.visit.offer.discount20')}</option>
              <option value="Diskon 30% selama 3 bulan + Voucher Rp100.000">{t('agent.visit.offer.discount30100')}</option>
              <option value="Diskon 30% selama 3 bulan + Voucher Rp200.000">{t('agent.visit.offer.discount30200')}</option>
              <option value="Belum ada offer yang disetujui">{t('agent.visit.offer.none')}</option>
            </select>
          </Field>
        </StepCard>
      )}

      <StepCard t={t} step="6" title={t('agent.visit.step6')}>
        {conversationResult === 'Bersedia bayar / Promise to Pay' && (
          <Field label={t('agent.visit.fieldPlannedDate')}>
            <input type="date" value={plannedPaymentDate} onChange={(e) => setPlannedPaymentDate(e.target.value)} className="dui-input w-full" />
          </Field>
        )}

        {conversationResult === 'Sudah melakukan pembayaran' ? (
          <div className="dui-alert dui-alert-success">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{t('agent.visit.paid')}</span>
          </div>
        ) : conversationResult !== 'Tidak bertemu pelanggan' ? (
          <Field label={t('agent.visit.fieldUnpaidReason')}>
            <select value={unpaidReason} onChange={(e) => setUnpaidReason(e.target.value)} className="dui-select w-full">
              <option value="">{t('agent.visit.unpaidPlaceholder')}</option>
              <option value="Masalah keuangan">{t('agent.visit.unpaid.financial')}</option>
              <option value="Harga / tagihan">{t('agent.visit.unpaid.price')}</option>
              <option value="Pindah ke provider lain">{t('agent.visit.unpaid.provider')}</option>
              <option value="Masalah jaringan / layanan">{t('agent.visit.unpaid.network')}</option>
              <option value="Jarang digunakan">{t('agent.visit.unpaid.rarelyUsed')}</option>
              <option value="Pindah alamat">{t('agent.visit.unpaid.movedAddress')}</option>
              <option value="Masalah sales">{t('agent.visit.unpaid.sales')}</option>
              <option value="Alasan pribadi">{t('agent.visit.unpaid.personal')}</option>
              <option value="Lainnya">{t('agent.visit.unpaid.other')}</option>
            </select>
          </Field>
        ) : (
          <div className="dui-alert dui-alert-info">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{t('agent.visit.conv.notMet')}</span>
          </div>
        )}
      </StepCard>

      <StepCard t={t} step="7" title={t('agent.visit.step7')}>
        <p className="text-sm text-base-content/60">
          {t('agent.visit.notesHint')}
        </p>
        <Field label={t('agent.visit.fieldNotes')}>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            className="dui-textarea w-full"
            rows={3}
            placeholder={t('agent.visit.notesPlaceholder')}
          />
        </Field>
      </StepCard>

      {error && (
        <div className="dui-alert dui-alert-error" role="alert">
          <XCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          <button
            type="button"
            className="dui-btn flex-1"
            onClick={() => router.push(backHref)}
            disabled={saving}
          >
            {t('agent.visit.cancel')}
          </button>
          <button
            type="button"
            className="dui-btn dui-btn-primary flex-1"
            disabled={saving}
            onClick={submitVisit}
          >
            {saving ? (
              <>
                <span className="dui-loading dui-loading-spinner dui-loading-sm" />
                {t('agent.visit.saving')}
              </>
            ) : (
              <>
                <Save className="h-5 w-5" aria-hidden="true" />
                {t('agent.visit.submit')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function StepCard({
  t,
  step,
  title,
  children,
}: {
  t: (key: string, params?: Record<string, string | number>) => string
  step: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={t('agent.visit.stepAria', { step, title })} className="dui-card border border-base-300 bg-base-100 shadow-sm">
      <div className="dui-card-body gap-4">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-base-content">
          <span className="dui-badge dui-badge-primary dui-badge-sm">{step}</span>
          {title}
        </h2>
        {children}
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dui-fieldset">
      <div className="dui-fieldset-label">
        <span>{label}</span>
      </div>
      {children}
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-box bg-base-200/60 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">{label}</div>
      <div className="mt-0.5 text-sm font-semibold break-words text-base-content">
        {value === null || value === undefined || value === '' ? '-' : String(value)}
      </div>
    </div>
  )
}
