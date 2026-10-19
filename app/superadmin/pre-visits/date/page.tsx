import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, ChevronLeft, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import FilterableDataTable from '@/components/superadmin/FilterableDataTable'

const PREVISIT_COLUMNS = [
  'previsit_id',
  'customer_id',
  'agent_email',
  'contact_attempt_date',
  'phone_contacted',
  'still_wants_visit',
  'customer_available',
  'willing_to_reschedule',
  'rescheduled_contact_date',
  'address_confirmed',
  'confirmed_address',
  'landmark',
  'wants_appointment',
  'appointment_date',
  'address_visited',
  'address_visit_date',
  'visited_address_correct',
  'contact_result',
  'previsit_notes',
  'previsit_status',
  'created_at',
  'updated_at',
  'reschedule_date',
  'still_want_to_visit',
  'direct_visit',
  'address_correct_on_arrival',
  'stop_reason',
  'contact_confirmed',
  'appointment_confirmed',
  'supervisor_approval',
  'unpaid_reason',
  'previous_previsit_id',
] as const

function jakartaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function normalizeDate(value: string) {
  const trimmed = value.trim()
  if (validDate(trimmed)) return trimmed
  const parts = trimmed.split('/')
  if (parts.length !== 3 || parts.some((part) => !part || !Array.from(part).every((char) => char >= '0' && char <= '9'))) return ''
  const [day, month, rawYear] = parts
  if (day.length > 2 || month.length > 2 || ![2, 4].includes(rawYear.length)) return ''
  const year = rawYear.length === 2 ? '20' + rawYear : rawYear
  const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  return validDate(normalized) ? normalized : ''
}

export default async function SuperadminPreVisitsByDatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const today = jakartaToday()
  const requestedStart = typeof params.start === 'string' ? params.start : today
  const startDate = normalizeDate(requestedStart) || today
  const requestedEnd = typeof params.end === 'string' ? params.end : startDate
  const validRequestedEnd = normalizeDate(requestedEnd) || startDate
  const endDate = validRequestedEnd >= startDate ? validRequestedEnd : startDate
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const email = user.email.trim().toLowerCase()
  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', email).maybeSingle()
  if (!currentUser || !currentUser.active || !['admin', 'superadmin'].includes(currentUser.role)) redirect('/auth/route')

  const start = new Date(`${startDate}T00:00:00+07:00`)
  const endInclusive = new Date(`${endDate}T00:00:00+07:00`)
  const endExclusive = new Date(endInclusive.getTime() + 24 * 60 * 60 * 1000)
  // Count with HEAD first; fetch all Circle-authorized rows in parallel chunks.
  // This avoids sequential request latency and Supabase's 1,000-row response cap.
  const pageSize = 500
  const countResult = await supabase.from('pre_visits')
    .select('previsit_id', { count: 'exact', head: true })
    .gte('created_at', start.toISOString()).lt('created_at', endExclusive.toISOString())
  let error: { message: string } | null = countResult.error
  let rows: Record<string, unknown>[] = []
  if (!error && (countResult.count ?? 0) > 0) {
    const pages = Math.ceil((countResult.count ?? 0) / pageSize)
    // Batch requests, rather than sending an unbounded number at once.
    for (let batchStart = 0; batchStart < pages; batchStart += 4) {
      const results = await Promise.all(
        Array.from({ length: Math.min(4, pages - batchStart) }, (_, index) => {
          const offset = (batchStart + index) * pageSize
          return supabase.from('pre_visits').select('*')
            .gte('created_at', start.toISOString()).lt('created_at', endExclusive.toISOString())
            .order('created_at', { ascending: true }).order('previsit_id', { ascending: true })
            .range(offset, offset + pageSize - 1)
        })
      )
      const failed = results.find((result) => result.error)
      if (failed?.error) { error = failed.error; rows = []; break }
      rows.push(...results.flatMap((result) => (result.data ?? []) as Record<string, unknown>[]))
    }
  }
  const rangeLabel = startDate === endDate ? startDate : `${startDate} → ${endDate}`

  return (
    <div className="mx-auto grid w-full max-w-[96rem] gap-5 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: 'Pre-Visits', href: '/superadmin/pre-visits' },
          { label: 'By Date Range' },
        ]}
        title="Pre-Visits by Date Range"
        description="Review every Supabase Pre-Visit field across a Jakarta/WIB date range."
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="form-control w-full sm:w-auto">
            <span className="mb-1 text-xs font-bold uppercase tracking-wide text-base-content/60">Start date (WIB)</span>
            <input className="dui-input dui-input-bordered" type="date" name="start" defaultValue={startDate} />
          </label>
          <label className="form-control w-full sm:w-auto">
            <span className="mb-1 text-xs font-bold uppercase tracking-wide text-base-content/60">End date (WIB)</span>
            <input className="dui-input dui-input-bordered" type="date" name="end" defaultValue={endDate} min={startDate} />
          </label>
          <button className="dui-btn dui-btn-secondary" type="submit"><CalendarDays className="size-4" />View Range</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Link className="dui-btn dui-btn-ghost" href="/superadmin/pre-visits"><ChevronLeft className="size-4" />Change View</Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-base-content/55">Selected range</div><div className="mt-1 text-xl font-black">{rangeLabel}</div></article>
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-base-content/55">Total pre-visits</div><div className="mt-1 text-xl font-black">{rows.length}</div></article>
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-base-content/55">Fields shown</div><div className="mt-1 text-xl font-black">{PREVISIT_COLUMNS.length}</div></article>
      </section>

      {error ? (
        <SuperadminState tone="error" icon={Inbox} title="Unable to load pre-visits" description={error.message} />
      ) : rows.length === 0 ? (
        <SuperadminState icon={Inbox} title="No pre-visits in this range" description="Choose another date range to review pre-visit records." />
      ) : (
        <FilterableDataTable
          columns={[...PREVISIT_COLUMNS]}
          rows={rows}
          fileName={`pre-visits-${startDate}-to-${endDate}.csv`}
          title="All Pre-Visit fields from Supabase"
        />
      )}
    </div>
  )
}
