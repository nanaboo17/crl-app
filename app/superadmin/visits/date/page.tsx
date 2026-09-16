import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, ChevronLeft, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import VisitReportButton from './VisitReportButton'

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

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export default async function SuperadminVisitsByDatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const requested = typeof params.date === 'string' ? params.date : jakartaToday()
  const date = validDate(requested) ? requested : jakartaToday()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const email = user.email.trim().toLowerCase()
  const { data: currentUser } = await supabase.from('agents').select('role, active').eq('email', email).maybeSingle()
  if (!currentUser || !currentUser.active || currentUser.role !== 'superadmin') redirect('/auth/route')

  const start = new Date(`${date}T00:00:00+07:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .gte('visit_date', start.toISOString())
    .lt('visit_date', end.toISOString())
    .order('visit_date', { ascending: true })

  const rows = (data ?? []) as Record<string, unknown>[]

  return (
    <div className="mx-auto grid w-full max-w-[96rem] gap-5 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: 'Visits', href: '/superadmin/visits' },
          { label: 'By Date' },
        ]}
        title="Visits by Date"
        description="Review every Supabase Visit field for one Jakarta/WIB calendar date."
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="form-control w-full sm:w-auto">
            <span className="mb-1 text-xs font-bold uppercase tracking-wide text-base-content/60">Visit date (WIB)</span>
            <input className="dui-input dui-input-bordered" type="date" name="date" defaultValue={date} />
          </label>
          <button className="dui-btn dui-btn-secondary" type="submit"><CalendarDays className="size-4" />View Date</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Link className="dui-btn dui-btn-ghost" href="/superadmin/visits"><ChevronLeft className="size-4" />Change View</Link>
          <VisitReportButton date={date} columns={[...VISIT_COLUMNS]} rows={rows} />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-base-content/55">Selected date</div><div className="mt-1 text-xl font-black">{date}</div></article>
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-base-content/55">Total visits</div><div className="mt-1 text-xl font-black">{rows.length}</div></article>
        <article className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-base-content/55">Fields shown</div><div className="mt-1 text-xl font-black">{VISIT_COLUMNS.length}</div></article>
      </section>

      {error ? (
        <SuperadminState tone="error" icon={Inbox} title="Unable to load visits" description={error.message} />
      ) : rows.length === 0 ? (
        <SuperadminState icon={Inbox} title="No visits on this date" description="Choose another date to review visit records." />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          <div className="border-b border-base-300 px-4 py-3">
            <h2 className="font-black">All Visit fields from Supabase</h2>
            <p className="text-sm text-base-content/60">Scroll horizontally to review all columns.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="dui-table dui-table-zebra min-w-max">
              <thead>
                <tr>{VISIT_COLUMNS.map((column) => <th key={column} className="whitespace-nowrap">{column}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={String(row.visit_id ?? index)}>
                    {VISIT_COLUMNS.map((column) => (
                      <td key={column} className="max-w-[22rem] whitespace-pre-wrap break-words align-top text-xs">{formatCell(row[column])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
