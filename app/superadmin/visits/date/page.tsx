import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, ChevronLeft, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import FilterableDataTable from '@/components/superadmin/FilterableDataTable'

const VISIT_COLUMNS = [
  'visit_id',
  'customer_id',
  'agent_email',
  'sales_code',
  'visit_date',
  'customer_phone',
  'updated_phone',
  'visit_address',
  'latitude',
  'longitude',
  'gps_accuracy',
  'gps_captured_at',
  'visit_photo_url',
  'consent_given',
  'visit_result',
  'visit_summary',
  'created_at',
  'distance_to_customer_meters',
  'location_match',
  'visit_status_kunjungan',
  'conversation_result',
  'approved_offer',
  'planned_payment_date',
  'unpaid_reason',
  'additional_notes',
] as const

function jakartaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default async function SuperadminVisitsByDatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const today = jakartaToday()
  const requestedStart = typeof params.start === 'string' ? params.start : today
  const startDate = validDate(requestedStart) ? requestedStart : today
  const requestedEnd = typeof params.end === 'string' ? params.end : startDate
  const validRequestedEnd = validDate(requestedEnd) ? requestedEnd : startDate
  const endDate = validRequestedEnd >= startDate ? validRequestedEnd : startDate
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const email = user.email.trim().toLowerCase()
  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', email).maybeSingle()
  if (!currentUser || !currentUser.active || currentUser.role !== 'superadmin') redirect('/auth/route')

  const start = new Date(`${startDate}T00:00:00+07:00`)
  const endInclusive = new Date(`${endDate}T00:00:00+07:00`)
  const endExclusive = new Date(endInclusive.getTime() + 24 * 60 * 60 * 1000)
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .gte('visit_date', start.toISOString())
    .lt('visit_date', endExclusive.toISOString())
    .order('visit_date', { ascending: true })

  const rows = (data ?? []) as Record<string, unknown>[]
  const rangeLabel = startDate === endDate ? startDate : `${startDate} → ${endDate}`

  return (
    <div className="mx-auto grid w-full max-w-[96rem] gap-5 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: 'Visits', href: '/superadmin/visits' },
          { label: 'By Date Range' },
        ]}
        title="Visits by Date Range"
        description="Review every Supabase Visit field across a Jakarta/WIB date range."
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
          <Link className="dui-btn dui-btn-ghost" href="/superadmin/visits"><ChevronLeft className="size-4" />Change View</Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-base-content/55">Selected range</div><div className="mt-1 text-xl font-black">{rangeLabel}</div></article>
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-base-content/55">Total visits</div><div className="mt-1 text-xl font-black">{rows.length}</div></article>
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-base-content/55">Fields shown</div><div className="mt-1 text-xl font-black">{VISIT_COLUMNS.length}</div></article>
      </section>

      {error ? (
        <SuperadminState tone="error" icon={Inbox} title="Unable to load visits" description={error.message} />
      ) : rows.length === 0 ? (
        <SuperadminState icon={Inbox} title="No visits in this range" description="Choose another date range to review visit records." />
      ) : (
        <FilterableDataTable
          columns={[...VISIT_COLUMNS]}
          rows={rows}
          fileName={`visit-report-${startDate}-to-${endDate}.csv`}
          title="All Visit fields from Supabase"
        />
      )}
    </div>
  )
}
