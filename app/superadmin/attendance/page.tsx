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

  const payload = await cacheGetOrSet<AttendancePayload>(`crl:superadmin:attendance:v3:${selectedDate}`, CACHE_TTL, async () => {
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
    <div className="mx-auto grid w-full max-w-7xl gap-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[{ label: 'Superadmin', href: '/superadmin' }, { label: 'Attendance' }]}
        title="Daily Attendance Monitoring"
        description="Attendance comes from agent_attendance for the selected Jakarta calendar day. The displayed photo is the agent check-in photo."
      />

      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <label className="grid gap-1 text-sm font-semibold">
          <span>Date</span>
          <input name="date" type="date" defaultValue={selectedDate} className="dui-input dui-input-bordered" />
        </label>
        <button type="submit" className="dui-btn dui-btn-primary">View day</button>
        {selectedDate !== today ? <Link href="/superadmin/attendance" className="dui-btn dui-btn-ghost">Today</Link> : null}
      </form>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Active agents', value: activeAgents.length, icon: Users },
          { label: 'Checked in', value: present, icon: CheckCircle2 },
          { label: 'Not checked in', value: absent, icon: XCircle },
          { label: 'Pre-visits', value: preVisitCount, icon: Clock3 },
          { label: 'Visits', value: visitCount, icon: CalendarDays },
        ].map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <Icon className="mb-3 size-5 text-primary" aria-hidden="true" />
            <div className="text-2xl font-black">{value}</div>
            <div className="text-sm text-base-content/60">{label}</div>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
        <div className="border-b border-base-300 p-4">
          <h2 className="font-bold">Agent attendance — {selectedDate}</h2>
          <p className="text-sm text-base-content/60">Check-in and check-out times are shown in WIB (Asia/Jakarta). Attendance is based on agent_attendance.check_in_at.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="dui-table">
            <thead><tr><th>Agent</th><th>Sales code</th><th>Account</th><th>Pre-visits</th><th>Visits</th><th>Attendance</th><th>Check in</th><th>Check out</th><th>Photo</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.email}>
                  <td><div className="font-semibold">{row.agent_name || '—'}</div><div className="text-xs text-base-content/50">{row.email}</div></td>
                  <td>{row.sales_code || '—'}</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                  <td>{row.preVisits}</td>
                  <td>{row.visits}</td>
                  <td><span className={`dui-badge ${row.present ? 'dui-badge-success' : 'dui-badge-ghost'}`}>{row.present ? 'Checked in' : 'Not checked in'}</span></td>
                  <td className="whitespace-nowrap font-semibold">{jakartaTime(row.checkInAt)}{row.checkInStatus ? <div className="mt-1 text-[11px] font-normal text-base-content/50">{row.checkInStatus}</div> : null}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
