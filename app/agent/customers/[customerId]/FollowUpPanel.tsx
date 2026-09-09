'use client'

import { FormEvent, useMemo, useState } from 'react'
import { BellPlus, CalendarPlus, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import styles from './page.module.css'

type FollowUp = {
  followup_id: string
  due_at: string
  note: string
  status: 'pending' | 'completed'
}

function googleCalendarUrl(row: FollowUp, customerId: string) {
  const start = new Date(row.due_at)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const format = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `CRL Follow-up · ${customerId}`,
    dates: `${format(start)}/${format(end)}`,
    details: `${row.note}\n\nCustomer ID: ${customerId}\nCRL follow-up reminder`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
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

  const pendingCount = useMemo(() => rows.filter((row) => row.status === 'pending').length, [rows])

  async function addReminder(event: FormEvent) {
    event.preventDefault()
    if (!dueAt || !note.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('customer_followups')
      .insert({
        customer_id: customerId,
        agent_email: agentEmail,
        due_at: new Date(dueAt).toISOString(),
        note: note.trim(),
        followup_type: 'manual',
        source_type: null,
        source_id: null,
      })
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
          <p>{tx(
            `${pendingCount} pending. Add only the follow-up reminders you want to see in the dashboard queue.`,
            `${pendingCount} tertunda. Tambahkan hanya pengingat follow-up yang ingin ditampilkan di antrean dashboard.`
          )}</p>
        </div>
      </div>

      <form className={styles.followupForm} onSubmit={addReminder}>
        <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx('e.g. Call customer again tomorrow', 'contoh: Hubungi pelanggan lagi besok')} required />
        <button type="submit" disabled={saving}>{saving ? tx('Saving…', 'Menyimpan…') : tx('Add follow-up reminder', 'Tambah pengingat follow-up')}</button>
      </form>

      {error && <div className={styles.followupError}>{error}</div>}

      <div className={styles.followupList}>
        {rows.length === 0 ? (
          <p className={styles.followupEmpty}>{tx('No follow-up reminders yet.', 'Belum ada pengingat follow-up.')}</p>
        ) : rows.map((row) => (
          <div key={row.followup_id} className={`${styles.followupItem} ${row.status === 'completed' ? styles.followupDone : ''}`}>
            <div>
              <strong>{new Date(row.due_at).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB')}</strong>
              <span>{row.note}</span>
            </div>
            {row.status === 'pending' ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={googleCalendarUrl(row, customerId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dui-btn dui-btn-outline dui-btn-xs gap-1"
                  title={tx('Open this follow-up in Google Calendar', 'Buka follow-up ini di Google Calendar')}
                >
                  <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  {tx('Google Calendar', 'Google Calendar')}
                </a>
                <button type="button" onClick={() => complete(row)}>{tx('Done', 'Selesai')}</button>
              </div>
            ) : (
              <span className={styles.doneLabel}><CheckCircle2 aria-hidden="true" />{tx('Completed', 'Selesai')}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
