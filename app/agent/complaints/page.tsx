import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ExternalLink, TicketCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { getComplaintTickets } from '@/lib/complaints'

const COMPLAINT_WEB_URL =
  'https://script.google.com/macros/s/AKfycbyCiplosm0JFAZpDeOEl5bBlY2pT3Vg77p9iTr2zc_GASU6eScltkcPSXGlvhmjqOgQ/exec'

function statusTone(status: string) {
  const value = String(status || '').trim().toLowerCase()
  if (value.includes('close') || value.includes('done') || value.includes('resolved')) return 'dui-badge-success'
  if (value.includes('open') || value.includes('new')) return 'dui-badge-warning'
  if (value.includes('progress') || value.includes('pending')) return 'dui-badge-info'
  return 'dui-badge-ghost'
}

export default async function AgentComplaintsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const email = user.email.trim().toLowerCase()
  const { data: agent } = await supabase
    .from('agents')
    .select('email,role,active')
    .ilike('email', email)
    .maybeSingle()

  if (!agent?.active) redirect('/login')
  if (agent.role !== 'agent') redirect('/auth/route')

  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('customer_id,customer_name')
    .eq('agent_email', email)

  if (customerError) {
    return <main className="mx-auto max-w-5xl p-6"><div className="dui-alert dui-alert-error">{customerError.message}</div></main>
  }

  const customerRows = customers || []
  const customerMap = new Map(customerRows.map((row: any) => [String(row.customer_id), row.customer_name || '']))
  let tickets: Awaited<ReturnType<typeof getComplaintTickets>> = []
  let complaintError = ''

  try {
    tickets = await getComplaintTickets(customerRows.map((row: any) => row.customer_id))
  } catch (error) {
    complaintError = error instanceof Error ? error.message : String(error)
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4 pb-24 sm:p-6">
      <Link href="/agent" className="dui-btn dui-btn-ghost dui-btn-sm gap-2 px-0">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <section className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-box bg-primary/10 text-primary">
            <TicketCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Complaint Tracking</p>
            <h1 className="text-2xl font-black">Assigned Customer Complaints</h1>
            <p className="mt-1 text-sm text-base-content/60">
              Complaint tickets are matched from Google Sheets using Billing ID (BA) = assigned customer ID.
            </p>
          </div>
        </div>
      </section>

      {complaintError && (
        <div className="dui-alert dui-alert-warning">
          <span>Complaint data could not be loaded: {complaintError}</span>
        </div>
      )}

      {!complaintError && tickets.length === 0 ? (
        <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm text-base-content/55">
          No complaint tickets were found for your assigned customers.
        </div>
      ) : (
        <div className="grid gap-3">
          {tickets.map((ticket, index) => {
            const customerName = customerMap.get(ticket.billingId) || ticket.custName || 'Customer'
            const trackUrl = `${COMPLAINT_WEB_URL}?billingId=${encodeURIComponent(ticket.billingId)}`
            return (
              <article id={`ticket-${ticket.billingId}-${index}`} key={`${ticket.billingId}-${ticket.ticketNumber}-${ticket.no}-${index}`} className="scroll-mt-24 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-base">{customerName}</strong>
                      <span className={`dui-badge dui-badge-sm ${statusTone(ticket.status)}`}>
                        {ticket.status || 'No status'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-base-content/55">
                      BA {ticket.billingId} {ticket.ticketNumber ? `· Ticket ${ticket.ticketNumber}` : ''}
                    </div>
                  </div>
                  <a href={trackUrl} target="_blank" rel="noreferrer" className="dui-btn dui-btn-outline dui-btn-sm gap-2">
                    Track complaint <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div><div className="text-[11px] font-bold uppercase text-base-content/45">Issue Type</div><div className="mt-1 text-sm">{ticket.issueType || '—'}</div></div>
                  <div><div className="text-[11px] font-bold uppercase text-base-content/45">Call Status</div><div className="mt-1 text-sm">{ticket.callStatus || '—'}</div></div>
                  <div><div className="text-[11px] font-bold uppercase text-base-content/45">Agent</div><div className="mt-1 text-sm">{ticket.agent || '—'}</div></div>
                  <div><div className="text-[11px] font-bold uppercase text-base-content/45">Submitted</div><div className="mt-1 text-sm">{ticket.timestamp || '—'}</div></div>
                </div>

                {(ticket.caseDetail || ticket.remarks) && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-box bg-base-200/50 p-3"><div className="text-[11px] font-bold uppercase text-base-content/45">Case Detail</div><div className="mt-1 text-sm">{ticket.caseDetail || '—'}</div></div>
                    <div className="rounded-box bg-base-200/50 p-3"><div className="text-[11px] font-bold uppercase text-base-content/45">Remarks</div><div className="mt-1 text-sm">{ticket.remarks || '—'}</div></div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
