import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, LogIn, LogOut, Timer, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { getLocale } from '@/lib/i18n/server'

const TIMEZONE = 'Asia/Jakarta'

type AttendanceRow = {
  attendance_date: string
  check_in_at: string | null
  check_out_at: string | null
  check_in_status: string | null
  worked_minutes: number | null
}

function jakartaDateKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function mondayOf(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`)
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString().slice(0, 10)
}

function formatDate(dateKey: string, locale: 'en' | 'id', withWeekday = false) {
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', {
    timeZone: 'UTC',
    weekday: withWeekday ? 'short' : undefined,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00Z`))
}

function formatTime(value: string | null, locale: 'en' | 'id') {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function formatDuration(minutes: number | null, locale: 'en' | 'id') {
  if (minutes === null || minutes === undefined) return '—'
  const safe = Math.max(0, Math.floor(minutes))
  const hours = Math.floor(safe / 60)
  const mins = safe % 60
  return locale === 'id' ? `${hours}j ${mins}m` : `${hours}h ${mins}m`
}

function statusLabel(value: string | null, locale: 'en' | 'id') {
  const normalized = (value || '').trim().toLowerCase()
  if (normalized === 'on_time') return locale === 'id' ? 'Tepat waktu' : 'On time'
  if (normalized === 'late') return locale === 'id' ? 'Terlambat' : 'Late'
  if (normalized === 'checked_in') return locale === 'id' ? 'Sudah check-in' : 'Checked in'
  if (normalized === 'checked_out') return locale === 'id' ? 'Sudah check-out' : 'Checked out'
  return value || (locale === 'id' ? 'Hadir' : 'Present')
}

function statusClass(value: string | null) {
  const normalized = (value || '').trim().toLowerCase()
  if (normalized === 'on_time') return 'dui-badge-success'
  if (normalized === 'late') return 'dui-badge-warning'
  return 'dui-badge-info'
}

function validWeek(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default async function AgentWeeklyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locale = await getLocale()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const params = await searchParams
  const today = jakartaDateKey(new Date())
  const requestedWeek = validWeek(params.week) ? String(params.week) : today
  const weekStart = mondayOf(requestedWeek)
  const weekEnd = addDays(weekStart, 6)
  const previousWeek = addDays(weekStart, -7)
  const nextWeek = addDays(weekStart, 7)
  const currentWeekStart = mondayOf(today)
  const canGoNext = nextWeek <= currentWeekStart

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const email = user.email.trim().toLowerCase()
  const { data: agent } = await supabase
    .from('agents')
    .select('agent_name, role, active')
    .ilike('email', email)
    .maybeSingle()

  if (!agent?.active || agent.role !== 'agent') redirect('/auth/route')

  const { data, error } = await supabase
    .from('agent_attendance')
    .select('attendance_date, check_in_at, check_out_at, check_in_status, worked_minutes')
    .eq('agent_email', email)
    .gte('attendance_date', weekStart)
    .lte('attendance_date', weekEnd)
    .order('attendance_date', { ascending: true })

  const attendance = (data ?? []) as AttendanceRow[]
  const byDate = new Map(attendance.map((row) => [row.attendance_date, row]))
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const presentRows = attendance.filter((row) => Boolean(row.check_in_at))
  const totalWorkedMinutes = attendance.reduce((sum, row) => sum + Number(row.worked_minutes || 0), 0)
  const lateDays = attendance.filter((row) => (row.check_in_status || '').toLowerCase() === 'late').length
  const completedDays = attendance.filter((row) => Boolean(row.check_out_at)).length

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4 pb-24 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
            {tx('My Attendance', 'Kehadiran Saya')}
          </p>
          <h1 className="text-2xl font-black sm:text-3xl">{tx('Weekly Attendance', 'Kehadiran Mingguan')}</h1>
          <p className="mt-1 text-sm text-base-content/60">
            {formatDate(weekStart, locale)} – {formatDate(weekEnd, locale)}
          </p>
        </div>
        <Link href="/agent/attendance" className="dui-btn dui-btn-primary gap-2">
          <Clock3 className="h-4 w-4" />
          {tx('Today / Check In-Out', 'Hari Ini / Check In-Out')}
        </Link>
      </div>

      {error ? (
        <div className="dui-alert dui-alert-error">
          <TriangleAlert className="h-5 w-5" />
          <span>{error.message}</span>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <CheckCircle2 className="mb-3 h-5 w-5 text-success" />
          <div className="text-2xl font-black">{presentRows.length}</div>
          <div className="text-sm text-base-content/60">{tx('Days present', 'Hari hadir')}</div>
        </article>
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <Timer className="mb-3 h-5 w-5 text-primary" />
          <div className="text-2xl font-black">{formatDuration(totalWorkedMinutes, locale)}</div>
          <div className="text-sm text-base-content/60">{tx('Total worked', 'Total bekerja')}</div>
        </article>
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <LogOut className="mb-3 h-5 w-5 text-info" />
          <div className="text-2xl font-black">{completedDays}</div>
          <div className="text-sm text-base-content/60">{tx('Completed days', 'Hari selesai')}</div>
        </article>
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <Clock3 className="mb-3 h-5 w-5 text-warning" />
          <div className="text-2xl font-black">{lateDays}</div>
          <div className="text-sm text-base-content/60">{tx('Late days', 'Hari terlambat')}</div>
        </article>
      </section>

      <section className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-bold">{tx('Daily attendance', 'Kehadiran harian')}</h2>
              <p className="text-xs text-base-content/50">{agent.agent_name || email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/agent/attendance/weekly?week=${previousWeek}`} className="dui-btn dui-btn-sm dui-btn-outline gap-1">
              <ChevronLeft className="h-4 w-4" /> {tx('Previous', 'Sebelumnya')}
            </Link>
            {weekStart !== currentWeekStart ? (
              <Link href="/agent/attendance/weekly" className="dui-btn dui-btn-sm dui-btn-ghost">
                {tx('This week', 'Minggu ini')}
              </Link>
            ) : null}
            {canGoNext ? (
              <Link href={`/agent/attendance/weekly?week=${nextWeek}`} className="dui-btn dui-btn-sm dui-btn-outline gap-1">
                {tx('Next', 'Berikutnya')} <ChevronRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 p-3 sm:p-4">
          {days.map((dateKey) => {
            const row = byDate.get(dateKey)
            const isToday = dateKey === today
            const isFuture = dateKey > today
            return (
              <article
                key={dateKey}
                className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] sm:items-center ${
                  isToday ? 'border-primary/40 bg-primary/5' : 'border-base-300 bg-base-100'
                }`}
              >
                <div>
                  <div className="font-bold">{formatDate(dateKey, locale, true)}</div>
                  {isToday ? <span className="dui-badge dui-badge-primary dui-badge-sm mt-1">{tx('Today', 'Hari ini')}</span> : null}
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-base-content/45">{tx('Status', 'Status')}</div>
                  <div className="mt-1">
                    {row?.check_in_at ? (
                      <span className={`dui-badge dui-badge-sm ${statusClass(row.check_in_status)}`}>
                        {statusLabel(row.check_in_status, locale)}
                      </span>
                    ) : (
                      <span className="text-sm text-base-content/50">
                        {isFuture ? tx('Upcoming', 'Belum berlangsung') : tx('No check-in', 'Belum check-in')}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-base-content/45"><LogIn className="h-3.5 w-3.5" />{tx('Check in', 'Check in')}</div>
                  <div className="mt-1 font-semibold">{formatTime(row?.check_in_at || null, locale)}</div>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-base-content/45"><LogOut className="h-3.5 w-3.5" />{tx('Check out', 'Check out')}</div>
                  <div className="mt-1 font-semibold">{formatTime(row?.check_out_at || null, locale)}</div>
                </div>

                <div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-base-content/45"><Timer className="h-3.5 w-3.5" />{tx('Worked', 'Durasi')}</div>
                  <div className="mt-1 font-semibold">{formatDuration(row?.worked_minutes ?? null, locale)}</div>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
