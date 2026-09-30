'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Gauge, Save } from 'lucide-react'
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
        .select('speed')
        .eq('customer_id', data.customer_id)
        .ilike('agent_email', user.email.trim())
        .maybeSingle()

      setCurrentSpeed(customerData?.speed == null ? null : Number(customerData.speed))
      setRow(data)
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

    const { error: speedError } = await supabase.rpc('save_assigned_customer_speed_test', {
      p_customer_id: row.customer_id,
      p_download_mbps: downloadValue,
      p_upload_mbps: uploadValue,
    })

    if (speedError) {
      setError(`Visit saved, but customer speed test could not be synchronized: ${speedError.message}`)
      setSaving(false)
      return
    }

    const { error: customerError } = await supabase.rpc('sync_assigned_customer_after_visit_edit', {
      p_customer_id: row.customer_id,
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

  if (loading) return <main className="mx-auto max-w-2xl p-6"><span className="dui-loading dui-loading-spinner dui-loading-lg" /></main>

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 p-4 pb-24 sm:p-6">
      <button type="button" onClick={() => router.back()} className="dui-btn dui-btn-ghost dui-btn-sm gap-2 px-0"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Edit visit</p>
        <h1 className="text-2xl font-bold">Edit visit data</h1>
        <p className="mt-1 text-sm opacity-60">Update this saved visit without creating a new visit. The original GPS and evidence photo remain attached.</p>
      </div>

      {error && <div className="dui-alert dui-alert-error"><span>{error}</span></div>}

      {row && (
        <form onSubmit={submit} className="space-y-4">
          <div className="dui-card border border-base-300 bg-base-100 shadow-sm"><div className="dui-card-body gap-4">
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Visit status</span><select className="dui-select dui-select-bordered w-full" value={form.visit_status_kunjungan} onChange={(e) => setForm({ ...form, visit_status_kunjungan: e.target.value })}><option value="">Select visit status</option><option value="Bertemu dengan pelanggan">Bertemu dengan pelanggan</option><option value="Pelanggan tidak ada di tempat">Pelanggan tidak ada di tempat</option><option value="Alamat tidak ditemukan">Alamat tidak ditemukan</option><option value="Pelanggan sudah pindah">Pelanggan sudah pindah</option><option value="Tidak berhasil dikunjungi">Tidak berhasil dikunjungi</option><option value="Lainnya">Lainnya</option></select></label>
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Conversation result</span><select className="dui-select dui-select-bordered w-full" value={form.conversation_result} onChange={(e) => setForm({ ...form, conversation_result: e.target.value })}><option value="">Select result</option><option value="Sudah melakukan pembayaran">Sudah melakukan pembayaran</option><option value="Bersedia bayar / Promise to Pay">Bersedia bayar / Promise to Pay</option><option value="Masih mempertimbangkan">Masih mempertimbangkan</option><option value="Tidak bersedia melanjutkan layanan">Tidak bersedia melanjutkan layanan</option><option value="Tidak bertemu pelanggan">Tidak bertemu pelanggan</option></select></label>
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Visit address</span><textarea className="dui-textarea dui-textarea-bordered min-h-24" value={form.visit_address} onChange={(e) => setForm({ ...form, visit_address: e.target.value })} /></label>
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Updated phone</span><input className="dui-input dui-input-bordered w-full" value={form.updated_phone} onChange={(e) => setForm({ ...form, updated_phone: e.target.value })} /></label>
          </div></div>

          <div className="dui-card border border-base-300 bg-base-100 shadow-sm"><div className="dui-card-body gap-4">
            <h2 className="flex items-center gap-2 text-base font-bold"><Gauge className="h-5 w-5 text-primary" /> Speed Information</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="dui-form-control"><span className="dui-label-text font-semibold">Speed Current</span><div className="dui-input dui-input-bordered flex w-full items-center bg-base-200/40">{currentSpeed == null ? '—' : `${currentSpeed} Mbps`}</div></label>
              <label className="dui-form-control"><span className="dui-label-text font-semibold">Speed Test Download</span><label className="dui-input dui-input-bordered flex w-full items-center gap-2"><input type="number" min="0" step="0.01" inputMode="decimal" className="grow" value={form.speed_test_download_mbps} onChange={(e) => setForm({ ...form, speed_test_download_mbps: e.target.value })} /><span className="text-xs font-semibold opacity-60">Mbps</span></label></label>
              <label className="dui-form-control"><span className="dui-label-text font-semibold">Speed Test Upload</span><label className="dui-input dui-input-bordered flex w-full items-center gap-2"><input type="number" min="0" step="0.01" inputMode="decimal" className="grow" value={form.speed_test_upload_mbps} onChange={(e) => setForm({ ...form, speed_test_upload_mbps: e.target.value })} /><span className="text-xs font-semibold opacity-60">Mbps</span></label></label>
            </div>
          </div></div>

          <div className="dui-card border border-base-300 bg-base-100 shadow-sm"><div className="dui-card-body gap-4">
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Approved offer</span><input className="dui-input dui-input-bordered w-full" value={form.approved_offer} onChange={(e) => setForm({ ...form, approved_offer: e.target.value })} /></label>
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Planned payment date</span><input type="date" className="dui-input dui-input-bordered w-full" value={form.planned_payment_date} onChange={(e) => setForm({ ...form, planned_payment_date: e.target.value })} /></label>
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Unpaid reason</span><input className="dui-input dui-input-bordered w-full" value={form.unpaid_reason} onChange={(e) => setForm({ ...form, unpaid_reason: e.target.value })} /></label>
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Additional notes</span><textarea className="dui-textarea dui-textarea-bordered min-h-28" value={form.additional_notes} onChange={(e) => setForm({ ...form, additional_notes: e.target.value })} /></label>
          </div></div>
          <button type="submit" disabled={saving} className="dui-btn dui-btn-primary w-full gap-2"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}</button>
        </form>
      )}
    </main>
  )
}
