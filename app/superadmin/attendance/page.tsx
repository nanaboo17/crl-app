import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, ImageIcon, Users, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { cacheGetOrSet } from '@/lib/redis-cache'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'

const CACHE_TTL = 60
const TIMEZONE = 'Asia/Jakarta'

type Agent = { email: string; agent_name: string | null; sales_code: string | null; active: boolean | null }
type Activity = { agent_email: string | null; created_at?: string | null; visit_date?: string | null; visit_photo_url?: string | null }
type AttendancePayload = { agents: Agent[]; visits: Activity[]; preVisits: Activity[] }

function jakartaDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

  const payload = await cacheGetOrSet<AttendancePayload>(`crl:superadmin:attendance:v2:${selectedDate}`, CACHE_TTL, async () => {
    const [agentsResult, visitsResult, preVisitsResult] = await Promise.all([
      supabase.from('agents').select('email, agent_name, sales_code, active').eq('role', 'agent').order('agent_name'),
      supabase.from('visits').select('agent_email, visit_date, visit_photo_url'),
      supabase.from('pre_visits').select('agent_email, created_at'),
    ])
    const error = agentsResult.error || visitsResult.error || preVisitsResult.error
    if (error) throw error
    return {
      agents: (agentsResult.data ?? []) as Agent[],
      visits: (visitsResult.data ?? []) as Activity[],
      preVisits: (preVisitsResult.data ?? []) as Activity[],
    }
  })

  const rows = payload.agents.map((agent) => {
    const email = agent.email.toLowerCase()
    const dayVisits = payload.visits.filter((row) => (row.agent_email || '').toLowerCase() === email && row.visit_date && jakartaDate(row.visit_date) === selectedDate)
    const dayPreVisits = payload.preVisits.filter((row) => (row.agent_email || '').toLowerCase() === email && row.created_at && jakartaDate(row.created_at) === selectedDate)
    const photos = dayVisits.map((row) => row.visit_photo_url).filter((value): value is string => Boolean(value))
    return {
      ...agent,
      visits: dayVisits.length,
      preVisits: dayPreVisits.length,
      present: dayVisits.length + dayPreVisits.length > 0,
      attendancePhoto: photos[0] ?? null,
      photoCount: photos.length,
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
        description="Attendance is inferred from recorded pre-visit or visit activity for the selected Jakarta calendar day. Visit photos are shown when available."
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
          { label: 'Present', value: present, icon: CheckCircle2 },
          { label: 'No activity', value: absent, icon: XCircle },
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
          <p className="text-sm text-base-content/60">Present means the agent created at least one pre-visit or visit record that day. The photo is the first visit photo recorded for that agent on the selected day.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="dui-table">
            <thead><tr><th>Agent</th><th>Sales code</th><th>Account</th><th>Pre-visits</th><th>Visits</th><th>Attendance</th><th>Photo</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.email}>
                  <td><div className="font-semibold">{row.agent_name || '—'}</div><div className="text-xs text-base-content/50">{row.email}</div></td>
                  <td>{row.sales_code || '—'}</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                  <td>{row.preVisits}</td>
                  <td>{row.visits}</td>
                  <td><span className={`dui-badge ${row.present ? 'dui-badge-success' : 'dui-badge-ghost'}`}>{row.present ? 'Present' : 'No activity'}</span></td>
                  <td>
                    {row.attendancePhoto ? (
                      <a
                        href={row.attendancePhoto}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-center gap-2 rounded-xl border border-base-300 bg-base-100 p-1.5 pr-3 transition hover:border-primary/40 hover:bg-base-200"
                        title={`View attendance photo${row.photoCount > 1 ? ` (${row.photoCount} visit photos)` : ''}`}
                      >
                        <img src={row.attendancePhoto} alt={`Attendance evidence for ${row.agent_name || row.email}`} className="h-12 w-12 rounded-lg object-cover" />
                        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                          View{row.photoCount > 1 ? ` +${row.photoCount - 1}` : ''}
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-base-content/40"><ImageIcon className="size-4" aria-hidden="true" />No photo</span>
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
