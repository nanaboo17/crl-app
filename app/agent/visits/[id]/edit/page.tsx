'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Gauge,
  MapPin,
  Phone,
  Save,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { retentionOffersForCustomer, NO_APPROVED_OFFER } from '@/lib/retention-offers'
import { useI18n } from '@/components/providers/i18n-provider'

export default function EditVisitPage() {
  const { t, locale } = useI18n()
  const tx = (en: string, id: string) => locale === 'id' ? id : en
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = decodeURIComponent(params.id)
  const [row, setRow] = useState<any>(null)
  const eligibleOffers = retentionOffersForCustomer(row?.customer_id)
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    visit_status_kunjungan: '',
    conversation_result: '',
    approved_offer: '',
    planned_payment_date: '',
    unpaid_reason: '',
    additional_notes: '',
    visit_address: '',
    updated_phone: '',
    speed_test_download_mbps: '',
    speed_test_upload_mbps: '',
  })

  useEffect(() => {
    if (form.conversation_result === 'Sudah melakukan pembayaran') {
      setForm((current) => ({
        ...current,
        unpaid_reason: 'Sudah bayar',
        planned_payment_date: '',
      }))
    } else if (form.conversation_result === 'Tidak bertemu pelanggan') {
      setForm((current) => ({
        ...current,
        approved_offer: NO_APPROVED_OFFER,
        planned_payment_date: '',
        unpaid_reason: '',
      }))
    }
  }, [form.conversation_result])

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return router.replace('/login')

      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('visit_id', id)
        .ilike('agent_email', user.email.trim())
        .maybeSingle()

      if (error || !data) {
        setError(error?.message || 'Visit record not found.')
        setLoading(false)
        return
      }

      const { data: customerData } = await supabase
        .from('customers')
        .select('speed,customer_name')
        .eq('crl_id', data.crl_id)
        .ilike('agent_email', user.email.trim())
        .maybeSingle()

      setCurrentSpeed(customerData?.speed == null ? null : Number(customerData.speed))
      setRow({ ...data, customer_name: customerData?.customer_name || null })
      setForm({
        visit_status_kunjungan: data.visit_status_kunjungan || '',
        conversation_result: data.conversation_result || data.visit_result || '',
        approved_offer: data.approved_offer || '',
        planned_payment_date: data.planned_payment_date || '',
        unpaid_reason: data.unpaid_reason || '',
        additional_notes: data.additional_notes || '',
        visit_address: data.visit_address || '',
        updated_phone: data.updated_phone || '',
        speed_test_download_mbps: data.speed_test_download_mbps == null ? '' : String(data.speed_test_download_mbps),
        speed_test_upload_mbps: data.speed_test_upload_mbps == null ? '' : String(data.speed_test_upload_mbps),
      })
      setLoading(false)
    })()
  }, [id, router])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!row) return
    if (!form.visit_status_kunjungan || !form.conversation_result) {
      setError('Visit status and conversation result are required.')
      return
    }

    if (form.conversation_result !== 'Tidak bertemu pelanggan' && !form.approved_offer) {
      setError(tx('Please select an approved offer.', 'Mohon pilih offer yang disetujui.'))
      return
    }

    if (form.approved_offer && form.approved_offer !== NO_APPROVED_OFFER && !eligibleOffers.some((offer) => offer.value === form.approved_offer)) {
      setError(tx('Selected offer is not available for this Customer ID.', 'Offer yang dipilih tidak tersedia untuk Customer ID ini.'))
      return
    }

    if (form.conversation_result === 'Bersedia bayar / Promise to Pay' && !form.planned_payment_date) {
      setError(tx('Please select the planned payment date.', 'Mohon pilih rencana tanggal pembayaran.'))
      return
    }

    if (
      form.conversation_result !== 'Sudah melakukan pembayaran' &&
      form.conversation_result !== 'Tidak bertemu pelanggan' &&
      !form.unpaid_reason
    ) {
      setError(tx('Please select the unpaid reason.', 'Mohon pilih alasan belum bayar.'))
      return
    }

    const downloadValue = form.speed_test_download_mbps.trim() === '' ? null : Number(form.speed_test_download_mbps)
    const uploadValue = form.speed_test_upload_mbps.trim() === '' ? null : Number(form.speed_test_upload_mbps)
    if (
      (downloadValue !== null && (!Number.isFinite(downloadValue) || downloadValue < 0)) ||
      (uploadValue !== null && (!Number.isFinite(uploadValue) || uploadValue < 0))
    ) {
      setError('Speed test values must be valid non-negative numbers.')
      return
    }

    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = {
      visit_status_kunjungan: form.visit_status_kunjungan,
      conversation_result: form.conversation_result,
      visit_result: form.conversation_result,
      approved_offer: form.approved_offer || null,
      planned_payment_date: form.planned_payment_date || null,
      unpaid_reason: form.conversation_result === 'Sudah melakukan pembayaran' ? 'Sudah bayar' : form.unpaid_reason || null,
      additional_notes: form.additional_notes.trim() || null,
      visit_address: form.visit_address.trim() || null,
      updated_phone: form.updated_phone.trim() || null,
      speed_test_download_mbps: downloadValue,
      speed_test_upload_mbps: uploadValue,
    }

    const { data: updatedVisit, error: visitError } = await supabase
      .from('visits')
      .update(payload)
      .eq('visit_id', id)
      .select('visit_id')
      .maybeSingle()

    if (visitError || !updatedVisit) {
      setError(visitError?.message || 'Visit could not be updated.')
      setSaving(false)
      return
    }

    const { error: speedError } = await supabase.rpc('save_assigned_customer_speed_test_by_crl', {
      p_crl_id: row.crl_id,
      p_download_mbps: downloadValue,
      p_upload_mbps: uploadValue,
    })

    if (speedError) {
      setError(`Visit saved, but customer speed test could not be synchronized: ${speedError.message}`)
      setSaving(false)
      return
    }

    const { error: customerError } = await supabase.rpc('sync_assigned_customer_after_visit_edit_by_crl', {
      p_crl_id: row.crl_id,
      p_payment_status: form.conversation_result === 'Sudah melakukan pembayaran' ? 'paid' : 'unpaid',
      p_phone_number: form.updated_phone.trim() || null,
    })

    if (customerError) {
      setError(`Visit saved, but customer status could not be synchronized: ${customerError.message}`)
      setSaving(false)
      return
    }

    router.replace(`/agent/visits/${encodeURIComponent(id)}`)
    router.refresh()
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[55vh] max-w-3xl items-center justify-center p-6">
        <span className="dui-loading dui-loading-spinner dui-loading-lg text-primary" />
      </main>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-28 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="dui-btn dui-btn-ghost dui-btn-sm gap-2 px-0"
        >
          <ArrowLeft className="h-4 w-4" />
          {tx('Back to visit detail', 'Kembali ke detail kunjungan')}
        </button>
        <span className="dui-badge dui-badge-primary dui-badge-outline">
          {tx('Edit Visit', 'Edit Kunjungan')}
        </span>
      </div>

      <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-card-body gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="dui-badge dui-badge-primary dui-badge-sm">{tx('EDIT MODE', 'MODE EDIT')}</span>
            <span className="dui-badge dui-badge-ghost dui-badge-sm">{id}</span>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">
              {row?.customer_name || row?.customer_id || tx('Visit data', 'Data kunjungan')}
            </h1>
            <p className="mt-1 text-sm text-base-content/60">
              {tx('Customer ID', 'Customer ID')}: <span className="font-semibold text-base-content">{row?.customer_id}</span>
              {row?.crl_id ? <> · CRL ID: <span className="font-semibold text-base-content">{row.crl_id}</span></> : null}
            </p>
          </div>
          <div className="dui-alert dui-alert-info py-3">
            <MapPin className="h-5 w-5 shrink-0" />
            <span className="text-sm">
              {tx(
                'You are editing the submitted visit. GPS and uploaded evidence stay attached to the original visit.',
                'Anda sedang mengedit kunjungan yang sudah dikirim. GPS dan bukti foto tetap terhubung ke kunjungan awal.'
              )}
            </span>
          </div>
        </div>
      </section>

      {error && (
        <div className="dui-alert dui-alert-error" role="alert">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {row && (
        <form onSubmit={submit} className="space-y-4">
          <StepCard step="1" title={tx('Location & Address', 'Lokasi & Alamat')}>
            <div className="dui-alert dui-alert-info">
              <MapPin className="h-5 w-5 shrink-0" />
              <span className="text-sm">
                {tx(
                  'The original GPS point is kept. You can update only the visit address below.',
                  'Titik GPS awal tetap digunakan. Anda hanya dapat memperbarui alamat kunjungan di bawah.'
                )}
              </span>
            </div>
            <Field label={tx('Visit address', 'Alamat kunjungan')}>
              <textarea
                className="dui-textarea w-full"
                rows={3}
                value={form.visit_address}
                onChange={(e) => setForm({ ...form, visit_address: e.target.value })}
                placeholder={tx('Customer visit address', 'Alamat kunjungan pelanggan')}
              />
            </Field>
          </StepCard>

          <StepCard step="2" title={tx('Customer Contact', 'Kontak Pelanggan')}>
            <Field label={tx('Updated phone number', 'Nomor telepon terbaru')}>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-base-content/40" />
                <input
                  type="tel"
                  inputMode="tel"
                  className="dui-input w-full pl-10"
                  value={form.updated_phone}
                  onChange={(e) => setForm({ ...form, updated_phone: e.target.value })}
                  placeholder="08xxxxxxxxxx / 62xxxxxxxxxxx"
                />
              </div>
            </Field>
          </StepCard>

          <StepCard step="3" title={tx('Evidence & Speed Test', 'Bukti & Speed Test')}>
            <div className="dui-alert dui-alert-info">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="text-sm">
                {tx(
                  'Existing visit photos remain unchanged. You can update the measured speed result here.',
                  'Foto kunjungan yang sudah ada tidak berubah. Anda dapat memperbarui hasil speed test di sini.'
                )}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ReadOnly
                label={tx('Subscribed speed', 'Speed pelanggan')}
                value={currentSpeed == null ? '—' : `${currentSpeed} Mbps`}
              />
              <SpeedInput
                label={tx('Download', 'Download')}
                value={form.speed_test_download_mbps}
                onChange={(value) => setForm({ ...form, speed_test_download_mbps: value })}
              />
              <SpeedInput
                label={tx('Upload', 'Upload')}
                value={form.speed_test_upload_mbps}
                onChange={(value) => setForm({ ...form, speed_test_upload_mbps: value })}
              />
            </div>
          </StepCard>

          <StepCard step="4" title={tx('Visit Result', 'Hasil Kunjungan')}>
            <Field label={tx('Visit status', 'Status kunjungan')}>
              <select
                className="dui-select w-full"
                value={form.visit_status_kunjungan}
                onChange={(e) => setForm({ ...form, visit_status_kunjungan: e.target.value })}
              >
                <option value="">{tx('Select visit status', 'Pilih status kunjungan')}</option>
                <option value="Bertemu dengan pelanggan">Bertemu dengan pelanggan</option>
                <option value="Pelanggan tidak ada di tempat">Pelanggan tidak ada di tempat</option>
                <option value="Alamat tidak ditemukan">Alamat tidak ditemukan</option>
                <option value="Pelanggan sudah pindah">Pelanggan sudah pindah</option>
                <option value="Tidak berhasil dikunjungi">Tidak berhasil dikunjungi</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </Field>

            <Field label={tx('Conversation result', 'Hasil percakapan')}>
              <select
                className="dui-select w-full"
                value={form.conversation_result}
                onChange={(e) => setForm({ ...form, conversation_result: e.target.value })}
              >
                <option value="">{tx('Select conversation result', 'Pilih hasil percakapan')}</option>
                <option value="Sudah melakukan pembayaran">Sudah melakukan pembayaran</option>
                <option value="Bersedia bayar / Promise to Pay">Bersedia bayar / Promise to Pay</option>
                <option value="Masih mempertimbangkan">Masih mempertimbangkan</option>
                <option value="Tidak bersedia melanjutkan layanan">Tidak bersedia melanjutkan layanan</option>
                <option value="Tidak bertemu pelanggan">Tidak bertemu pelanggan</option>
              </select>
            </Field>
          </StepCard>

          {form.conversation_result !== 'Tidak bertemu pelanggan' && (
            <StepCard step="5" title={tx('Offer Approved by Customer', 'Offer yang Disetujui Pelanggan')}>
              <p className="text-sm text-base-content/60">
                {tx(
                  'Keep the approved retention offer aligned with the original visit flow.',
                  'Pastikan offer retention yang disetujui sesuai dengan alur kunjungan awal.'
                )}
              </p>
              <Field label={tx('Approved offer', 'Offer yang disetujui')}>
                <select
                  className="dui-select w-full"
                  value={form.approved_offer}
                  onChange={(event) => setForm({ ...form, approved_offer: event.target.value })}
                >
                  <option value="">{tx('Select offer', 'Pilih offer')}</option>
                  {eligibleOffers.map((offer) => (
                    <option key={offer.value} value={offer.value}>{offer.label}</option>
                  ))}
                  <option value={NO_APPROVED_OFFER}>{tx('No approved offer yet', 'Belum ada offer yang disetujui')}</option>
                  {form.approved_offer &&
                    form.approved_offer !== NO_APPROVED_OFFER &&
                    !eligibleOffers.some((offer) => offer.value === form.approved_offer) && (
                      <option value={form.approved_offer} disabled>
                        {form.approved_offer} ({tx('previous offer — unavailable', 'offer sebelumnya — tidak tersedia')})
                      </option>
                    )}
                </select>
              </Field>
            </StepCard>
          )}

          <StepCard step="6" title={tx('Payment Follow-up', 'Tindak Lanjut Pembayaran')}>
            {form.conversation_result === 'Bersedia bayar / Promise to Pay' && (
              <Field label={tx('Planned payment date', 'Rencana tanggal pembayaran')}>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-base-content/40" />
                  <input
                    type="date"
                    className="dui-input w-full pl-10"
                    value={form.planned_payment_date}
                    onChange={(e) => setForm({ ...form, planned_payment_date: e.target.value })}
                  />
                </div>
              </Field>
            )}

            {form.conversation_result === 'Sudah melakukan pembayaran' ? (
              <div className="dui-alert dui-alert-success">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{tx('Customer has completed payment.', 'Pelanggan sudah melakukan pembayaran.')}</span>
              </div>
            ) : form.conversation_result === 'Tidak bertemu pelanggan' ? (
              <div className="dui-alert dui-alert-info">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{tx('Customer was not met during the visit.', 'Pelanggan tidak bertemu saat kunjungan.')}</span>
              </div>
            ) : (
              <Field label={tx('Unpaid reason', 'Alasan belum bayar')}>
                <select
                  className="dui-select w-full"
                  value={form.unpaid_reason}
                  onChange={(e) => setForm({ ...form, unpaid_reason: e.target.value })}
                >
                  <option value="">{tx('Select unpaid reason', 'Pilih alasan belum bayar')}</option>
                  <option value="Masalah keuangan">Masalah keuangan</option>
                  <option value="Harga / tagihan">Harga / tagihan</option>
                  <option value="Pindah ke provider lain">Pindah ke provider lain</option>
                  <option value="Masalah jaringan / layanan">Masalah jaringan / layanan</option>
                  <option value="Jarang digunakan">Jarang digunakan</option>
                  <option value="Pindah alamat">Pindah alamat</option>
                  <option value="Masalah sales">Masalah sales</option>
                  <option value="Alasan pribadi">Alasan pribadi</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </Field>
            )}
          </StepCard>

          <StepCard step="7" title={tx('Additional Notes', 'Catatan Tambahan')}>
            <p className="text-sm text-base-content/60">
              {tx(
                'Update important information collected from the customer.',
                'Perbarui informasi penting yang didapat dari pelanggan.'
              )}
            </p>
            <Field label={tx('Additional notes', 'Catatan tambahan')}>
              <textarea
                className="dui-textarea w-full"
                rows={4}
                value={form.additional_notes}
                onChange={(e) => setForm({ ...form, additional_notes: e.target.value })}
                placeholder={tx('Add visit notes...', 'Tambahkan catatan kunjungan...')}
              />
            </Field>
          </StepCard>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 p-3 backdrop-blur">
            <div className="mx-auto flex max-w-3xl gap-2">
              <button
                type="button"
                className="dui-btn flex-1"
                onClick={() => router.back()}
                disabled={saving}
              >
                {tx('Cancel', 'Batal')}
              </button>
              <button
                type="submit"
                className="dui-btn dui-btn-primary flex-1"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="dui-loading dui-loading-spinner dui-loading-sm" />
                    {tx('Saving...', 'Menyimpan...')}
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    {tx('Save Changes', 'Simpan Perubahan')}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

function StepCard({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
      <div className="dui-card-body gap-4">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
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
      <div className="dui-fieldset-label"><span>{label}</span></div>
      {children}
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-box bg-base-200/60 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  )
}

function SpeedInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="rounded-box border border-base-300 bg-base-100 p-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">{label}</span>
      <div className="mt-1 flex items-end gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent text-lg font-bold outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
        />
        <span className="pb-0.5 text-xs text-base-content/50">Mbps</span>
      </div>
    </label>
  )
}
