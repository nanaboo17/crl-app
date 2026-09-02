'use client'

import { FormEvent, useState } from 'react'
import { BellPlus, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'

type FollowUp = {
  followup_id: string
  due_at: string
  note: string
  status: 'pending' | 'completed'
}

export default function FollowUpPanel({
  customerId,
  agentEmail,
  initialRows,
  locale,
}: {
  customerId: string
  agentEmail: string
  initialRows: FollowUp[]
  locale: string
}) {
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const [rows, setRows] = useState(initialRows)
  const [dueAt, setDueAt] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function addReminder(event: FormEvent) {
    event.preventDefault()
    if (!dueAt || !note.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('customer_followups')
      .insert({ customer_id: customerId, agent_email: agentEmail, due_at: new Date(dueAt).toISOString(), note: note.trim() })
      .select('followup_id,due_at,note,status')
      .single()

    if (error) setError(error.message)
    else {
      setRows((current) => [...current, data as FollowUp].sort((a, b) => a.due_at.localeCompare(b.due_at)))
      setDueAt('')
      setNote('')
    }
    setSaving(false)
  }

  async function complete(row: FollowUp) {
    const supabase = createClient()
    const { error } = await supabase
      .from('customer_followups')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('followup_id', row.followup_id)

    if (error) setError(error.message)
    else setRows((current) => current.map((item) => item.followup_id === row.followup_id ? { ...item, status: 'completed' } : item))
  }

  return (
    <section className={styles.followupCard} aria-label={tx('Follow-up reminders', 'Pengingat tindak lanjut')}>
      <div className={styles.sectionHeading}>
        <BellPlus aria-hidden="true" />
        <div>
          <h2>{tx('Follow-up reminders', 'Pengingat tindak lanjut')}</h2>
          <p>{tx('Create a reminder for a call, payment promise, or revisit.', 'Buat pengingat untuk telepon, janji pembayaran, atau kunjungan ulang.')}</p>
        </div>
      </div>

      <form className={styles.followupForm} onSubmit={addReminder}>
        <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx('e.g. Call about payment promise', 'contoh: Hubungi terkait janji pembayaran')} required />
        <button type="submit" disabled={saving}>{saving ? tx('Saving…', 'Menyimpan…') : tx('Add reminder', 'Tambah pengingat')}</button>
      </form>

      {error && <div className={styles.followupError}>{error}</div>}

      <div className={styles.followupList}>
        {rows.length === 0 ? (
          <p className={styles.followupEmpty}>{tx('No reminders yet.', 'Belum ada pengingat.')}</p>
        ) : rows.map((row) => (
          <div key={row.followup_id} className={`${styles.followupItem} ${row.status === 'completed' ? styles.followupDone : ''}`}>
            <div>
              <strong>{new Date(row.due_at).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB')}</strong>
              <span>{row.note}</span>
            </div>
            {row.status === 'pending' ? (
              <button type="button" onClick={() => complete(row)}>{tx('Done', 'Selesai')}</button>
            ) : (
              <span className={styles.doneLabel}><CheckCircle2 aria-hidden="true" />{tx('Completed', 'Selesai')}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
