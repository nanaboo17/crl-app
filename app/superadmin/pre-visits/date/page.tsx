import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import FilterableDataTable from '@/components/superadmin/FilterableDataTable'
import IonicDateRangePicker from '@/components/superadmin/IonicDateRangePicker'

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
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default async function SuperadminPreVisitsByDatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
  if (!currentUser || !currentUser.active || !['admin', 'superadmin'].includes(currentUser.role)) redirect('/auth/route')

  const start = new Date(`${startDate}T00:00:00+07:00`)
  const endInclusive = new Date(`${endDate}T00:00:00+07:00`)
  const endExclusive = new Date(endInclusive.getTime() + 24 * 60 * 60 * 1000)
  const { data, error } = await supabase
    .from('pre_visits')
    .select('*')
    .gte('created_at', start.toISOString())
    .lt('created_at', endExclusive.toISOString())
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as Record<string, unknown>[]
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
        <IonicDateRangePicker
          basePath="/superadmin/pre-visits/date"
          initialStart={startDate}
          initialEnd={endDate}
          startLabel="Pre-Visit start date (WIB)"
          endLabel="Pre-Visit end date (WIB)"
        />
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
