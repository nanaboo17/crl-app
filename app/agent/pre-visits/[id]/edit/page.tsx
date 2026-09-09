'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

export default function EditStoppedPreVisitPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = decodeURIComponent(params.id)
  const [row, setRow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    contact_result: '',
    confirmed_address: '',
    landmark: '',
    unpaid_reason: '',
    stop_reason: '',
    previsit_notes: '',
  })

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return router.replace('/login')

      const { data, error } = await supabase
        .from('pre_visits')
        .select('*')
        .eq('previsit_id', id)
        .eq('agent_email', user.email.trim().toLowerCase())
        .maybeSingle()

      if (error || !data) {
        setError(error?.message || 'Pre-visit record not found.')
        setLoading(false)
        return
      }

      if (data.previsit_status !== 'Stopped') {
        setError('Only stopped pre-visit records can be edited here.')
        setLoading(false)
        return
      }

      setRow(data)
      setForm({
        contact_result: data.contact_result || '',
        confirmed_address: data.confirmed_address || '',
        landmark: data.landmark || '',
        unpaid_reason: data.unpaid_reason || '',
        stop_reason: data.stop_reason || '',
        previsit_notes: data.previsit_notes || '',
      })
      setLoading(false)
    })()
  }, [id, router])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!row) return
    if (!form.previsit_notes.trim()) {
      setError('Pre-Visit notes are required.')
      return
    }

    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase
      .from('pre_visits')
      .update({
        contact_result: form.contact_result.trim() || null,
        confirmed_address: form.confirmed_address.trim() || null,
        landmark: form.landmark.trim() || null,
        unpaid_reason: form.unpaid_reason.trim() || null,
        stop_reason: form.stop_reason.trim() || null,
        previsit_notes: form.previsit_notes.trim(),
      })
      .eq('previsit_id', id)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    router.replace(`/agent/pre-visits/${encodeURIComponent(id)}`)
    router.refresh()
  }

  if (loading) return <main className="mx-auto max-w-2xl p-6"><span className="dui-loading dui-loading-spinner dui-loading-lg" /></main>

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 p-4 pb-24 sm:p-6">
      <button type="button" onClick={() => router.back()} className="dui-btn dui-btn-ghost dui-btn-sm gap-2 px-0">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Stopped pre-visit</p>
        <h1 className="text-2xl font-bold">Edit pre-visit data</h1>
        <p className="mt-1 text-sm opacity-60">Update the saved information without creating a new pre-visit record.</p>
      </div>

      {error && <div className="dui-alert dui-alert-error"><span>{error}</span></div>}

      {row && (
        <form onSubmit={submit} className="space-y-4">
          <div className="dui-card border border-base-300 bg-base-100 shadow-sm">
            <div className="dui-card-body gap-4">
              <label className="dui-form-control">
                <span className="dui-label-text font-semibold">Contact result</span>
                <input className="dui-input dui-input-bordered w-full" value={form.contact_result} onChange={(e) => setForm({ ...form, contact_result: e.target.value })} />
              </label>
              <label className="dui-form-control">
                <span className="dui-label-text font-semibold">Confirmed address</span>
                <textarea className="dui-textarea dui-textarea-bordered min-h-24" value={form.confirmed_address} onChange={(e) => setForm({ ...form, confirmed_address: e.target.value })} />
              </label>
              <label className="dui-form-control">
                <span className="dui-label-text font-semibold">Landmark</span>
                <input className="dui-input dui-input-bordered w-full" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
              </label>
              <label className="dui-form-control">
                <span className="dui-label-text font-semibold">Unpaid reason</span>
                <input className="dui-input dui-input-bordered w-full" value={form.unpaid_reason} onChange={(e) => setForm({ ...form, unpaid_reason: e.target.value })} />
              </label>
              <label className="dui-form-control">
                <span className="dui-label-text font-semibold">Stop reason</span>
                <textarea className="dui-textarea dui-textarea-bordered min-h-20" value={form.stop_reason} onChange={(e) => setForm({ ...form, stop_reason: e.target.value })} />
              </label>
              <label className="dui-form-control">
                <span className="dui-label-text font-semibold">Pre-Visit notes *</span>
                <textarea required className="dui-textarea dui-textarea-bordered min-h-28" value={form.previsit_notes} onChange={(e) => setForm({ ...form, previsit_notes: e.target.value })} />
              </label>
            </div>
          </div>

          <button type="submit" disabled={saving} className="dui-btn dui-btn-primary w-full gap-2">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
    </main>
  )
}
