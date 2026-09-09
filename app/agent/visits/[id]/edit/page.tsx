'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

const STOPPED_VISIT_STATUSES = new Set([
  'Pelanggan tidak ada di tempat',
  'Alamat tidak ditemukan',
  'Pelanggan sudah pindah',
  'Tidak berhasil dikunjungi',
  'Lainnya',
])

export default function EditStoppedVisitPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = decodeURIComponent(params.id)
  const [row, setRow] = useState<any>(null)
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
        .eq('agent_email', user.email.trim().toLowerCase())
        .maybeSingle()

      if (error || !data) {
        setError(error?.message || 'Visit record not found.')
        setLoading(false)
        return
      }

      if (!STOPPED_VISIT_STATUSES.has(data.visit_status_kunjungan || '')) {
        setError('Only stopped / unsuccessful visit records can be edited here.')
        setLoading(false)
        return
      }

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
    }

    const { error } = await supabase.from('visits').update(payload).eq('visit_id', id)
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    const customerUpdate: Record<string, string> = {
      visit_status: 'Visited',
      customer_status: '5. Visited',
      payment_status: form.conversation_result === 'Sudah melakukan pembayaran' ? 'paid' : 'unpaid',
    }
    if (form.updated_phone.trim()) customerUpdate.phone_number = form.updated_phone.trim()

    const { error: customerError } = await supabase
      .from('customers')
      .update(customerUpdate)
      .eq('customer_id', row.customer_id)

    if (customerError) {
      setError(customerError.message)
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
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Stopped visit</p>
        <h1 className="text-2xl font-bold">Edit visit data</h1>
        <p className="mt-1 text-sm opacity-60">The original GPS and evidence photo remain attached to this visit.</p>
      </div>

      {error && <div className="dui-alert dui-alert-error"><span>{error}</span></div>}

      {row && (
        <form onSubmit={submit} className="space-y-4">
          <div className="dui-card border border-base-300 bg-base-100 shadow-sm"><div className="dui-card-body gap-4">
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Visit status</span><select className="dui-select dui-select-bordered w-full" value={form.visit_status_kunjungan} onChange={(e) => setForm({ ...form, visit_status_kunjungan: e.target.value })}><option value="Pelanggan tidak ada di tempat">Pelanggan tidak ada di tempat</option><option value="Alamat tidak ditemukan">Alamat tidak ditemukan</option><option value="Pelanggan sudah pindah">Pelanggan sudah pindah</option><option value="Tidak berhasil dikunjungi">Tidak berhasil dikunjungi</option><option value="Lainnya">Lainnya</option><option value="Bertemu dengan pelanggan">Bertemu dengan pelanggan</option></select></label>
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Conversation result</span><select className="dui-select dui-select-bordered w-full" value={form.conversation_result} onChange={(e) => setForm({ ...form, conversation_result: e.target.value })}><option value="">Select result</option><option value="Sudah melakukan pembayaran">Sudah melakukan pembayaran</option><option value="Bersedia bayar / Promise to Pay">Bersedia bayar / Promise to Pay</option><option value="Masih mempertimbangkan">Masih mempertimbangkan</option><option value="Tidak bersedia melanjutkan layanan">Tidak bersedia melanjutkan layanan</option><option value="Tidak bertemu pelanggan">Tidak bertemu pelanggan</option></select></label>
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Visit address</span><textarea className="dui-textarea dui-textarea-bordered min-h-24" value={form.visit_address} onChange={(e) => setForm({ ...form, visit_address: e.target.value })} /></label>
            <label className="dui-form-control"><span className="dui-label-text font-semibold">Updated phone</span><input className="dui-input dui-input-bordered w-full" value={form.updated_phone} onChange={(e) => setForm({ ...form, updated_phone: e.target.value })} /></label>
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
