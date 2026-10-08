'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  Gauge,
  MapPin,
  MessageSquareText,
  NotebookText,
  Phone,
  Save,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

export default function EditVisitPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = decodeURIComponent(params.id)
  const [row, setRow] = useState<any>(null)
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
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4 pb-28 sm:p-6 lg:p-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="dui-btn dui-btn-ghost dui-btn-sm gap-2 px-0"
      >
        <ArrowLeft className="h-4 w-4" /> Back to visit detail
      </button>

      <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
        <div className="bg-gradient-to-r from-primary/12 via-primary/5 to-transparent px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="dui-badge dui-badge-primary dui-badge-sm">EDIT VISIT</span>
                <span className="dui-badge dui-badge-ghost dui-badge-sm">{id}</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {row?.customer_name || row?.customer_id || 'Visit data'}
              </h1>
              <p className="mt-1 text-sm text-base-content/60">
                Customer ID: <span className="font-semibold text-base-content/75">{row?.customer_id}</span>
                {row?.crl_id ? <> · CRL ID: <span className="font-semibold text-base-content/75">{row.crl_id}</span></> : null}
              </p>
            </div>
            <div className="rounded-xl border border-base-300 bg-base-100/80 px-4 py-3 text-sm backdrop-blur sm:text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-base-content/45">Original record</div>
              <div className="mt-1 font-semibold">GPS & evidence stay attached</div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="dui-alert dui-alert-error shadow-sm" role="alert">
          <span>{error}</span>
        </div>
      )}

      {row && (
        <form onSubmit={submit} className="space-y-5">
          <SectionCard
            icon={<MessageSquareText className="h-5 w-5" />}
            eyebrow="VISIT OUTCOME"
            title="Visit & conversation result"
            description="Update the visit status and what happened during the customer interaction."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Visit status" required>
                <select
                  className="dui-select dui-select-bordered w-full"
                  value={form.visit_status_kunjungan}
                  onChange={(e) => setForm({ ...form, visit_status_kunjungan: e.target.value })}
                >
                  <option value="">Select visit status</option>
                  <option value="Bertemu dengan pelanggan">Bertemu dengan pelanggan</option>
                  <option value="Pelanggan tidak ada di tempat">Pelanggan tidak ada di tempat</option>
                  <option value="Alamat tidak ditemukan">Alamat tidak ditemukan</option>
                  <option value="Pelanggan sudah pindah">Pelanggan sudah pindah</option>
                  <option value="Tidak berhasil dikunjungi">Tidak berhasil dikunjungi</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </FormField>

              <FormField label="Conversation result" required>
                <select
                  className="dui-select dui-select-bordered w-full"
                  value={form.conversation_result}
                  onChange={(e) => setForm({ ...form, conversation_result: e.target.value })}
                >
                  <option value="">Select result</option>
                  <option value="Sudah melakukan pembayaran">Sudah melakukan pembayaran</option>
                  <option value="Bersedia bayar / Promise to Pay">Bersedia bayar / Promise to Pay</option>
                  <option value="Masih mempertimbangkan">Masih mempertimbangkan</option>
                  <option value="Tidak bersedia melanjutkan layanan">Tidak bersedia melanjutkan layanan</option>
                  <option value="Tidak bertemu pelanggan">Tidak bertemu pelanggan</option>
                </select>
              </FormField>
            </div>
          </SectionCard>

          <SectionCard
            icon={<MapPin className="h-5 w-5" />}
            eyebrow="CUSTOMER CONTACT"
            title="Address & contact"
            description="Adjust only if the field information collected during the visit is different."
          >
            <FormField label="Visit address">
              <textarea
                className="dui-textarea dui-textarea-bordered min-h-28 w-full resize-y"
                value={form.visit_address}
                onChange={(e) => setForm({ ...form, visit_address: e.target.value })}
                placeholder="Customer visit address"
              />
            </FormField>

            <FormField label="Updated phone" icon={<Phone className="h-4 w-4" />}>
              <input
                type="tel"
                inputMode="tel"
                className="dui-input dui-input-bordered w-full"
                value={form.updated_phone}
                onChange={(e) => setForm({ ...form, updated_phone: e.target.value })}
                placeholder="08xxxxxxxxxx or 62xxxxxxxxxxx"
              />
            </FormField>
          </SectionCard>

          <SectionCard
            icon={<Gauge className="h-5 w-5" />}
            eyebrow="NETWORK QUALITY"
            title="Speed test result"
            description="Compare the customer's subscribed speed with the measured download and upload result."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricField
                label="Speed Current"
                value={currentSpeed == null ? '—' : `${currentSpeed} Mbps`}
                muted
              />

              <SpeedInput
                label="Download"
                value={form.speed_test_download_mbps}
                onChange={(value) => setForm({ ...form, speed_test_download_mbps: value })}
              />

              <SpeedInput
                label="Upload"
                value={form.speed_test_upload_mbps}
                onChange={(value) => setForm({ ...form, speed_test_upload_mbps: value })}
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={<Sparkles className="h-5 w-5" />}
            eyebrow="RETENTION"
            title="Offer & payment"
            description="Keep the agreed offer and payment follow-up aligned with the visit outcome."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Approved offer">
                <input
                  className="dui-input dui-input-bordered w-full"
                  value={form.approved_offer}
                  onChange={(e) => setForm({ ...form, approved_offer: e.target.value })}
                  placeholder="Approved retention offer"
                />
              </FormField>

              <FormField label="Planned payment date" icon={<CalendarDays className="h-4 w-4" />}>
                <input
                  type="date"
                  className="dui-input dui-input-bordered w-full"
                  value={form.planned_payment_date}
                  onChange={(e) => setForm({ ...form, planned_payment_date: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Unpaid reason">
              <input
                className="dui-input dui-input-bordered w-full"
                value={form.unpaid_reason}
                onChange={(e) => setForm({ ...form, unpaid_reason: e.target.value })}
                placeholder="Reason customer has not paid"
              />
            </FormField>
          </SectionCard>

          <SectionCard
            icon={<NotebookText className="h-5 w-5" />}
            eyebrow="NOTES"
            title="Additional notes"
            description="Add any context that will help the next follow-up."
          >
            <FormField label="Notes">
              <textarea
                className="dui-textarea dui-textarea-bordered min-h-32 w-full resize-y"
                value={form.additional_notes}
                onChange={(e) => setForm({ ...form, additional_notes: e.target.value })}
                placeholder="Add visit notes..."
              />
            </FormField>
          </SectionCard>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur">
            <div className="mx-auto flex max-w-3xl gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                className="dui-btn flex-1 sm:flex-none sm:min-w-32"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="dui-btn dui-btn-primary flex-1 gap-2 sm:min-w-48 sm:flex-none sm:ml-auto"
              >
                {saving ? (
                  <span className="dui-loading dui-loading-spinner dui-loading-sm" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Saving changes…' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      )}
    </main>
  )
}

function SectionCard({
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="border-b border-base-200 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">{eyebrow}</div>
            <h2 className="mt-0.5 text-base font-bold sm:text-lg">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-base-content/55 sm:text-sm">{description}</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5 sm:p-6">{children}</div>
    </section>
  )
}

function FormField({
  label,
  required = false,
  icon,
  children,
}: {
  label: string
  required?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-base-content/80">
        {icon}
        {label}
        {required && <span className="text-error">*</span>}
      </span>
      {children}
    </label>
  )
}

function MetricField({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${muted ? 'border-base-300 bg-base-200/45' : 'border-base-300 bg-base-100'}`}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-base-content/45">{label}</div>
      <div className="mt-2 text-xl font-bold tracking-tight">{value}</div>
    </div>
  )
}

function SpeedInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="rounded-xl border border-base-300 bg-base-100 p-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
      <span className="text-[11px] font-bold uppercase tracking-wide text-base-content/45">{label}</span>
      <div className="mt-2 flex items-end gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
        />
        <span className="pb-0.5 text-xs font-semibold text-base-content/45">Mbps</span>
      </div>
    </label>
  )
}
