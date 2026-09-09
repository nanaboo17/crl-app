'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ClipboardPenLine, Save, StickyNote } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import PageTop from '@/components/PageTop'
import styles from './page.module.css'

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

  if (loading) {
    return (
      <main className={styles.page}>
        <PageTop title="Edit Pre-Visit" back />
        <div className={styles.loading}><span className={styles.spinner} /></div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <PageTop title="Edit Pre-Visit" back />

      <section className={styles.headerCard}>
        <span className={styles.eyebrow}>Stopped pre-visit</span>
        <h1>Edit pre-visit data</h1>
        <p>Correct the saved information without creating a new pre-visit record.</p>
        {row && (
          <div className={styles.recordMeta}>
            <span>{row.previsit_id}</span>
            <span>Customer {row.customer_id}</span>
            <span>Status: {row.previsit_status}</span>
          </div>
        )}
      </section>

      {error && <div className={styles.error}>{error}</div>}

      {row && (
        <form onSubmit={submit} className={styles.form}>
          <section className={styles.card}>
            <div className={styles.sectionTitle}>
              <div className={styles.sectionIcon}><ClipboardPenLine size={18} /></div>
              <div>
                <h2>Pre-Visit information</h2>
                <p>Update the customer contact and location information for this stopped record.</p>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="contact_result">Contact result</label>
              <input id="contact_result" value={form.contact_result} onChange={(e) => setForm({ ...form, contact_result: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="confirmed_address">Confirmed address</label>
              <textarea id="confirmed_address" value={form.confirmed_address} onChange={(e) => setForm({ ...form, confirmed_address: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="landmark">Landmark</label>
              <input id="landmark" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="unpaid_reason">Unpaid reason</label>
              <input id="unpaid_reason" value={form.unpaid_reason} onChange={(e) => setForm({ ...form, unpaid_reason: e.target.value })} />
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionTitle}>
              <div className={styles.sectionIcon}><StickyNote size={18} /></div>
              <div>
                <h2>Stop reason & notes</h2>
                <p>Keep the reason and field notes accurate before saving.</p>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="stop_reason">Stop reason</label>
              <textarea id="stop_reason" value={form.stop_reason} onChange={(e) => setForm({ ...form, stop_reason: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label htmlFor="previsit_notes">Pre-Visit notes *</label>
              <textarea id="previsit_notes" required className={styles.notes} value={form.previsit_notes} onChange={(e) => setForm({ ...form, previsit_notes: e.target.value })} />
            </div>
          </section>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={() => router.back()}>Cancel</button>
            <button type="submit" disabled={saving} className={styles.saveButton}>
              <Save size={17} /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
