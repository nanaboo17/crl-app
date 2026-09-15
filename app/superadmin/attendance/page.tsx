import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, ImageIcon, Users, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { cacheGetOrSet } from '@/lib/redis-cache'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'

const CACHE_TTL = 60
const TIMEZONE = 'Asia/Jakarta'
const PHOTO_URL_TTL = 60 * 60

type Agent = { email: string; agent_name: string | null; sales_code: string | null; active: boolean | null }
type VisitActivity = { agent_email: string | null; visit_date: string | null }
type PreVisitActivity = { agent_email: string | null; created_at: string | null }
type AttendanceRecord = {
  agent_email: string
  attendance_date: string
  check_in_at: string | null
  check_out_at: string | null
  check_in_photo_path: string | null
  check_out_photo_path: string | null
  check_in_status: string | null
  worked_minutes: number | null
}
type AttendancePayload = {
  agents: Agent[]
  visits: VisitActivity[]
  preVisits: PreVisitActivity[]
  attendance: AttendanceRecord[]
}

function jakartaDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function jakartaTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function attendanceStatusLabel(value: string | null) {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  const labels: Record<string, string> = {
    on_time: 'On Time',
    late: 'Late',
    checked_in: 'Checked In',
    checked_out: 'Checked Out',
    absent: 'Absent',
  }
  return labels[normalized] ?? value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function attendanceStatusBadgeClass(value: string | null) {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'on_time') return 'dui-badge-success'
  if (normalized === 'late') return 'dui-badge-warning'
  return 'dui-badge-ghost'
}

function validDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const today = jakartaDate(new Date())
  const selectedDate = validDate(params.date) ? String(params.date) : today
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', user.email.trim().toLowerCase()).maybeSingle()
  if (!currentUser || !currentUser.active || currentUser.role !== 'superadmin') redirect('/auth/route')

  const payload = await cacheGetOrSet<AttendancePayload>(`crl:superadmin:attendance:v4:${selectedDate}`, CACHE_TTL, async () => {
    const [agentsResult, visitsResult, preVisitsResult, attendanceResult] = await Promise.all([
      supabase.from('agents').select('email, agent_name, sales_code, active').eq('role', 'agent').order('agent_name'),
      supabase.from('visits').select('agent_email, visit_date'),
      supabase.from('pre_visits').select('agent_email, created_at'),
      supabase
        .from('agent_attendance')
        .select('agent_email, attendance_date, check_in_at, check_out_at, check_in_photo_path, check_out_photo_path, check_in_status, worked_minutes')
        .eq('attendance_date', selectedDate),
    ])

    const error = agentsResult.error || visitsResult.error || preVisitsResult.error || attendanceResult.error
    if (error) throw error

    return {
      agents: (agentsResult.data ?? []) as Agent[],
      visits: (visitsResult.data ?? []) as VisitActivity[],
      preVisits: (preVisitsResult.data ?? []) as PreVisitActivity[],
      attendance: (attendanceResult.data ?? []) as AttendanceRecord[],
    }
  })

  const attendanceMap = new Map(payload.attendance.map((row) => [row.agent_email.toLowerCase(), row]))
  const checkInPhotoPaths = Array.from(new Set(
    payload.attendance
      .map((row) => row.check_in_photo_path)
      .filter((path): path is string => Boolean(path))
  ))

  const photoUrlMap = new Map<string, string>()
  if (checkInPhotoPaths.length > 0) {
    const { data: signedPhotos, error: signedError } = await supabase.storage
      .from('attendance-evidence')
      .createSignedUrls(checkInPhotoPaths, PHOTO_URL_TTL)

    if (signedError) {
      console.error('attendance check-in photo signing failed:', signedError.message)
    } else {
      signedPhotos?.forEach((item, index) => {
        if (item.signedUrl) photoUrlMap.set(checkInPhotoPaths[index], item.signedUrl)
      })
    }
  }

  const rows = payload.agents.map((agent) => {
    const email = agent.email.toLowerCase()
    const dayVisits = payload.visits.filter((row) => (row.agent_email || '').toLowerCase() === email && row.visit_date && jakartaDate(row.visit_date) === selectedDate)
    const dayPreVisits = payload.preVisits.filter((row) => (row.agent_email || '').toLowerCase() === email && row.created_at && jakartaDate(row.created_at) === selectedDate)
    const attendance = attendanceMap.get(email) ?? null
    const photoPath = attendance?.check_in_photo_path ?? null

    return {
      ...agent,
      visits: dayVisits.length,
      preVisits: dayPreVisits.length,
      present: Boolean(attendance?.check_in_at),
      checkInAt: attendance?.check_in_at ?? null,
      checkOutAt: attendance?.check_out_at ?? null,
      checkInStatus: attendance?.check_in_status ?? null,
      workedMinutes: attendance?.worked_minutes ?? null,
      attendancePhoto: photoPath ? photoUrlMap.get(photoPath) ?? null : null,
    }
  })

  const activeAgents = rows.filter((row) => row.active)
  const present = activeAgents.filter((row) => row.present).length
  const absent = activeAgents.length - present
  const visitCount = rows.reduce((sum, row) => sum + row.visits, 0)
  const preVisitCount = rows.reduce((sum, row) => sum + row.preVisits, 0)

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5 p-3 sm:gap-6 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[{ label: 'Superadmin', href: '/superadmin' }, { label: 'Attendance' }]}
        title="Daily Attendance Monitoring"
      />

      <form className="grid gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:flex sm:flex-wrap sm:items-end">
        <label className="grid w-full gap-1 text-sm font-semibold sm:w-auto">
          <span>Date</span>
          <input name="date" type="date" defaultValue={selectedDate} className="dui-input dui-input-bordered w-full sm:w-auto" />
        </label>
        <button type="submit" className="dui-btn dui-btn-primary w-full sm:w-auto">View day</button>
        {selectedDate !== today ? <Link href="/superadmin/attendance" className="dui-btn dui-btn-ghost w-full sm:w-auto">Today</Link> : null}
      </form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Active agents', value: activeAgents.length, icon: Users },
          { label: 'Checked in', value: present, icon: CheckCircle2 },
          { label: 'Not checked in', value: absent, icon: XCircle },
          { label: 'Pre-visits', value: preVisitCount, icon: Clock3 },
          { label: 'Visits', value: visitCount, icon: CalendarDays },
        ].map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm sm:p-4">
            <Icon className="mb-2 size-5 text-primary sm:mb-3" aria-hidden="true" />
            <div className="text-xl font-black sm:text-2xl">{value}</div>
            <div className="text-xs text-base-content/60 sm:text-sm">{label}</div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
        <div className="border-b border-base-300 p-4">
          <h2 className="font-bold">Agent attendance — {selectedDate}</h2>
        </div>

        <div className="grid gap-3 p-3 md:hidden">
          {rows.map((row) => {
            const statusLabel = attendanceStatusLabel(row.checkInStatus)
            return (
              <article key={row.email} className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold">{row.agent_name || '—'}</div>
                    <div className="break-all text-xs text-base-content/50">{row.email}</div>
                    <div className="mt-1 text-xs text-base-content/60">{row.sales_code || 'No sales code'}</div>
                  </div>
                  <span className={`dui-badge shrink-0 ${row.present ? 'dui-badge-success' : 'dui-badge-ghost'}`}>{row.present ? 'Checked In' : 'Not Checked In'}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-base-200/60 p-3"><div className="text-xs text-base-content/50">Check In</div><div className="font-bold">{jakartaTime(row.checkInAt)}</div>{statusLabel ? <span className={`dui-badge dui-badge-sm mt-1 ${attendanceStatusBadgeClass(row.checkInStatus)}`}>{statusLabel}</span> : null}</div>
                  <div className="rounded-xl bg-base-200/60 p-3"><div className="text-xs text-base-content/50">Check Out</div><div className="font-bold">{jakartaTime(row.checkOutAt)}</div></div>
                  <div className="rounded-xl bg-base-200/60 p-3"><div className="text-xs text-base-content/50">Pre-visits</div><div className="font-bold">{row.preVisits}</div></div>
                  <div className="rounded-xl bg-base-200/60 p-3"><div className="text-xs text-base-content/50">Visits</div><div className="font-bold">{row.visits}</div></div>
                </div>

                <div className="mt-3">
                  {row.attendancePhoto ? (
                    <a href={row.attendancePhoto} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-2">
                      <img src={row.attendancePhoto} alt={`Check-in attendance evidence for ${row.agent_name || row.email}`} className="h-14 w-14 rounded-lg object-cover" />
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm font-semibold text-primary">View check-in photo<ExternalLink className="size-4 shrink-0" aria-hidden="true" /></span>
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-base-content/40"><ImageIcon className="size-4" aria-hidden="true" />No check-in photo</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="dui-table">
            <thead><tr><th>Agent</th><th>Sales code</th><th>Account</th><th>Pre-visits</th><th>Visits</th><th>Attendance</th><th>Check in</th><th>Check out</th><th>Photo</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const statusLabel = attendanceStatusLabel(row.checkInStatus)
                return (
                  <tr key={row.email}>
                    <td><div className="font-semibold">{row.agent_name || '—'}</div><div className="text-xs text-base-content/50">{row.email}</div></td>
                    <td>{row.sales_code || '—'}</td>
                    <td>{row.active ? 'Active' : 'Inactive'}</td>
                    <td>{row.preVisits}</td>
                    <td>{row.visits}</td>
                    <td><span className={`dui-badge ${row.present ? 'dui-badge-success' : 'dui-badge-ghost'}`}>{row.present ? 'Checked In' : 'Not Checked In'}</span></td>
                    <td className="whitespace-nowrap font-semibold">{jakartaTime(row.checkInAt)}{statusLabel ? <div className="mt-1"><span className={`dui-badge dui-badge-sm ${attendanceStatusBadgeClass(row.checkInStatus)}`}>{statusLabel}</span></div> : null}</td>
                    <td className="whitespace-nowrap font-semibold">{jakartaTime(row.checkOutAt)}</td>
                    <td>
                      {row.attendancePhoto ? (
                        <a
                          href={row.attendancePhoto}
                          target="_blank"
                          rel="noreferrer"
                          className="group inline-flex items-center gap-2 rounded-xl border border-base-300 bg-base-100 p-1.5 pr-3 transition hover:border-primary/40 hover:bg-base-200"
                          title="View check-in attendance photo"
                        >
                          <img src={row.attendancePhoto} alt={`Check-in attendance evidence for ${row.agent_name || row.email}`} className="h-12 w-12 rounded-lg object-cover" />
                          <span className="flex items-center gap-1 text-xs font-semibold text-primary">View<ExternalLink className="size-3" aria-hidden="true" /></span>
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-base-content/40"><ImageIcon className="size-4" aria-hidden="true" />No check-in photo</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
