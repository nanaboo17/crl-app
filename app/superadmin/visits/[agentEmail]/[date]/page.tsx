import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import styles from './page.module.css'
import { getLocale } from '@/lib/i18n/server'

function durationLabel(from: string | null, to: string | null) {
  if (!from || !to) return '-'
  const minutes = Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60000))
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

function timeLabel(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
}

export default async function AgentDailyVisitsPage({ params }: { params: Promise<{ agentEmail: string; date: string }> }) {
  const { agentEmail, date } = await params
  const decodedEmail = decodeURIComponent(agentEmail)
  const locale = await getLocale()
  const tx = (en: string, id: string) => locale === 'id' ? id : en
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', user.email.trim().toLowerCase()).maybeSingle()
  if (!currentUser || !currentUser.active || currentUser.role !== 'superadmin') redirect('/auth/route')

  const { data: agent } = await supabase.from('agents').select('email, agent_name, sales_code').eq('email', decodedEmail).maybeSingle()
  if (!agent) return <main className={styles.page}><div className={styles.errorCard}>{tx('Agent not found.', 'Agen tidak ditemukan.')}</div></main>

  const startDate = `${date}T00:00:00+07:00`
  const endDate = `${date}T23:59:59.999+07:00`

  const [visitResult, attendanceResult] = await Promise.all([
    supabase.from('visits').select('visit_id,customer_id,visit_date,visit_status_kunjungan,conversation_result,distance_to_customer_meters,location_match').eq('agent_email', decodedEmail).gte('visit_date', startDate).lte('visit_date', endDate).order('visit_date', { ascending: true }),
    supabase.from('agent_attendance').select('check_in_at,check_out_at,check_in_status,worked_minutes,check_in_photo_path,check_out_photo_path').eq('agent_email', decodedEmail).eq('attendance_date', date).maybeSingle(),
  ])

  if (visitResult.error) return <main className={styles.page}><div className={styles.errorCard}>{visitResult.error.message}</div></main>

  const visits = visitResult.data ?? []
  const attendance = attendanceResult.data
  const customerIds = [...new Set(visits.map(v => v.customer_id))]
  let customers: any[] = []
  if (customerIds.length) {
    const { data } = await supabase.from('customers').select('customer_id,customer_name,payment_status').in('customer_id', customerIds)
    customers = data ?? []
  }
  const customerMap = new Map(customers.map(c => [c.customer_id, c]))

  let checkInPhoto = ''
  let checkOutPhoto = ''
  if (attendance?.check_in_photo_path) {
    const { data } = await supabase.storage.from('attendance-evidence').createSignedUrl(attendance.check_in_photo_path, 3600)
    checkInPhoto = data?.signedUrl ?? ''
  }
  if (attendance?.check_out_photo_path) {
    const { data } = await supabase.storage.from('attendance-evidence').createSignedUrl(attendance.check_out_photo_path, 3600)
    checkOutPhoto = data?.signedUrl ?? ''
  }

  const checkpoints = visits.map((visit, index) => {
    const previousAt = index === 0 ? attendance?.check_in_at ?? null : visits[index - 1].visit_date
    return { ...visit, sequence: index + 1, duration: durationLabel(previousAt, visit.visit_date) }
  })

  const gpsMatchCount = visits.filter(v => v.location_match === true).length
  const gpsMismatchCount = visits.filter(v => v.location_match === false).length

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href={`/superadmin/visits/${encodeURIComponent(decodedEmail)}`} className={styles.backButton}>{tx('Back', 'Kembali')}</Link>
        <div><p className={styles.eyebrow}>{tx('VISIT MONITORING', 'MONITORING KUNJUNGAN')}</p><h1>{agent.agent_name}</h1><p>{new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
      </header>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}><span>{tx('Total visits', 'Total kunjungan')}</span><strong>{visits.length}</strong></div>
        <div className={styles.statCard}><span>GPS Match</span><strong>{gpsMatchCount}</strong></div>
        <div className={styles.statCard}><span>GPS Mismatch</span><strong>{gpsMismatchCount}</strong></div>
      </section>

      <section className={styles.monitorCard}>
        <div className={styles.monitorHeader}><div><p className={styles.eyebrow}>{tx('FIELD TIMELINE', 'TIMELINE LAPANGAN')}</p><h2>{tx('Attendance & Checkpoints', 'Absensi & Checkpoint')}</h2></div>{attendance?.check_in_status && <span className={`${styles.statusBadge} ${attendance.check_in_status === 'late' ? styles.late : styles.onTime}`}>{attendance.check_in_status === 'late' ? 'Late' : 'On time'}</span>}</div>
        <div className={styles.attendanceSummary}>
          <div><span>Check in</span><strong>{timeLabel(attendance?.check_in_at ?? null)}</strong>{checkInPhoto && <a href={checkInPhoto} target="_blank" rel="noreferrer">{tx('View photo', 'Lihat foto')}</a>}</div>
          <div><span>Check out</span><strong>{timeLabel(attendance?.check_out_at ?? null)}</strong>{checkOutPhoto && <a href={checkOutPhoto} target="_blank" rel="noreferrer">{tx('View photo', 'Lihat foto')}</a>}</div>
          <div><span>{tx('Work duration', 'Durasi kerja')}</span><strong>{attendance?.worked_minutes ? durationLabel(new Date(0).toISOString(), new Date(attendance.worked_minutes * 60000).toISOString()) : attendance?.check_in_at ? durationLabel(attendance.check_in_at, attendance.check_out_at ?? new Date().toISOString()) : '-'}</strong></div>
        </div>

        <div className={styles.checkpointList}>
          <div className={styles.checkpointRow}><span className={styles.checkpointDot}>IN</span><div><strong>Check In</strong><small>{timeLabel(attendance?.check_in_at ?? null)}</small></div><span>-</span></div>
          {checkpoints.map(cp => {
            const customer = customerMap.get(cp.customer_id)
            return <div key={cp.visit_id} className={styles.checkpointRow}><span className={styles.checkpointDot}>{cp.sequence}</span><div><strong>{tx('Checkpoint', 'Checkpoint')} {cp.sequence} · {customer?.customer_name || cp.customer_id}</strong><small>{timeLabel(cp.visit_date)} · {cp.visit_id}</small></div><span>{cp.duration}</span></div>
          })}
          {attendance?.check_out_at && <div className={styles.checkpointRow}><span className={styles.checkpointDot}>OUT</span><div><strong>Check Out</strong><small>{timeLabel(attendance.check_out_at)}</small></div><span>{durationLabel(visits.at(-1)?.visit_date ?? attendance.check_in_at, attendance.check_out_at)}</span></div>}
        </div>
      </section>

      <section className={styles.list}>
        {[...visits].reverse().map(visit => {
          const customer = customerMap.get(visit.customer_id)
          return <Link key={visit.visit_id} href={`/superadmin/visits/${encodeURIComponent(decodedEmail)}/${date}/${encodeURIComponent(visit.visit_id)}`} className={styles.visitCard}>
            <div className={styles.cardTop}><div><span className={styles.visitId}>{visit.visit_id}</span><h2>{customer?.customer_name || visit.customer_id}</h2><p>{visit.customer_id}</p></div><span className={styles.arrow}>›</span></div>
            <div className={styles.infoGrid}><div><span>{tx('Visit status', 'Status kunjungan')}</span><strong>{visit.visit_status_kunjungan || '-'}</strong></div><div><span>{tx('Conversation result', 'Hasil percakapan')}</span><strong>{visit.conversation_result || '-'}</strong></div><div><span>{tx('Payment', 'Pembayaran')}</span><strong>{customer?.payment_status?.toUpperCase() || '-'}</strong></div><div><span>{tx('Distance', 'Jarak')}</span><strong>{visit.distance_to_customer_meters != null ? `${Number(visit.distance_to_customer_meters).toFixed(1)} m` : '-'}</strong></div></div>
            <div className={styles.footer}><span>{timeLabel(visit.visit_date)}</span><span className={visit.location_match === true ? styles.matchBadge : visit.location_match === false ? styles.mismatchBadge : styles.unknownBadge}>{visit.location_match === true ? 'GPS Match' : visit.location_match === false ? 'GPS Mismatch' : 'GPS Unknown'}</span></div>
          </Link>
        })}
        {visits.length === 0 && <div className={styles.emptyState}><h2>{tx('No visits submitted', 'Belum ada kunjungan')}</h2><p>{tx('Attendance can still be monitored above.', 'Absensi tetap dapat dimonitor di atas.')}</p></div>}
      </section>
    </main>
  )
}
