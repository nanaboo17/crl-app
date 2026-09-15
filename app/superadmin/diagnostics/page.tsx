import { redirect } from 'next/navigation'
import { AlertTriangle, Bug, CheckCircle2, Info, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'

const LIMIT = 200

function fmt(value: string) {
  return `${new Date(value).toLocaleString('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })} WIB`
}

function formLabel(value: string) {
  if (value === 'previsit') return 'Pre-Visit'
  if (value === 'visit') return 'Visit'
  if (value === 'attendance') return 'Attendance'
  return value || 'Unknown'
}

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const form = typeof params.form === 'string' ? params.form : ''
  const severity = typeof params.severity === 'string' ? params.severity : ''
  const agent = typeof params.agent === 'string' ? params.agent.trim() : ''
  const customer = typeof params.customer === 'string' ? params.customer.trim() : ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { data: profile } = await supabase
    .from('agents')
    .select('role,active')
    .ilike('email', user.email.trim())
    .maybeSingle()

  if (!profile?.active || !['admin', 'superadmin'].includes(profile.role)) redirect('/auth/route')

  let query = supabase
    .from('field_form_diagnostic_logs')
    .select('log_id,created_at,agent_email,customer_id,form_type,stage,severity,request_method,request_target,http_status,error_code,error_message,error_details,error_hint,page_path,online,user_agent,metadata')
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  if (form === 'previsit' || form === 'visit' || form === 'attendance') query = query.eq('form_type', form)
  if (severity === 'info' || severity === 'warning' || severity === 'error') query = query.eq('severity', severity)
  if (agent) query = query.ilike('agent_email', `%${agent}%`)
  if (customer) query = query.eq('customer_id', customer)

  const { data: logs, error } = await query

  return (
    <main className="space-y-5 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[{ label: 'Superadmin', href: '/superadmin' }, { label: 'Diagnostics', icon: Bug }]}
        title="Field Form Diagnostics"
        description="Detailed Pre-Visit, Visit, and Attendance errors captured from agent devices. Times are shown in WIB."
      />

      <form className="grid gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm md:grid-cols-5">
        <label className="dui-fieldset"><span className="dui-fieldset-label">Form</span><select name="form" defaultValue={form} className="dui-select w-full"><option value="">All forms</option><option value="previsit">Pre-Visit</option><option value="visit">Visit</option><option value="attendance">Attendance</option></select></label>
        <label className="dui-fieldset"><span className="dui-fieldset-label">Severity</span><select name="severity" defaultValue={severity} className="dui-select w-full"><option value="">All</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option></select></label>
        <label className="dui-fieldset"><span className="dui-fieldset-label">Agent email</span><input name="agent" defaultValue={agent} className="dui-input w-full" placeholder="agent@email.com" /></label>
        <label className="dui-fieldset"><span className="dui-fieldset-label">Customer ID</span><input name="customer" defaultValue={customer} className="dui-input w-full" placeholder="Customer ID (not used for attendance)" /></label>
        <div className="flex items-end"><button className="dui-btn dui-btn-primary w-full"><Search className="h-4 w-4" /> Filter</button></div>
      </form>

      {error ? (
        <div className="dui-alert dui-alert-error"><AlertTriangle className="h-5 w-5" /><span>{error.message}</span></div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between text-sm text-base-content/60"><span>Showing newest {logs?.length ?? 0} logs</span><span>Maximum {LIMIT} rows</span></div>
          {(logs ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-10 text-center text-base-content/60">No diagnostic logs match this filter.</div>
          ) : (logs ?? []).map((log: any) => {
            const Icon = log.severity === 'error' ? AlertTriangle : log.severity === 'warning' ? Info : CheckCircle2
            return (
              <article key={log.log_id} className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-200 pb-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${log.severity === 'error' ? 'bg-error/10 text-error' : log.severity === 'warning' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}><Icon className="h-5 w-5" /></span>
                    <div><div className="font-black">{formLabel(log.form_type)} · {log.stage}</div><div className="text-sm text-base-content/60">{fmt(log.created_at)} · {log.agent_email}</div></div>
                  </div>
                  <div className="flex flex-wrap gap-2"><span className="dui-badge dui-badge-outline">{log.severity}</span>{log.customer_id && <span className="dui-badge dui-badge-outline">Customer {log.customer_id}</span>}{log.http_status && <span className="dui-badge dui-badge-outline">HTTP {log.http_status}</span>}{log.error_code && <span className="dui-badge dui-badge-outline">{log.error_code}</span>}</div>
                </div>
                <div className="mt-3 grid gap-3 text-sm lg:grid-cols-2">
                  <div className="space-y-2"><div><span className="font-semibold text-base-content/50">Message</span><div className="break-words font-semibold">{log.error_message || '—'}</div></div>{log.error_details && <div><span className="font-semibold text-base-content/50">Details</span><div className="break-words">{log.error_details}</div></div>}{log.error_hint && <div><span className="font-semibold text-base-content/50">Hint</span><div className="break-words">{log.error_hint}</div></div>}</div>
                  <div className="space-y-2"><div><span className="font-semibold text-base-content/50">Request</span><div className="break-all font-mono text-xs">{[log.request_method, log.request_target].filter(Boolean).join(' ') || '—'}</div></div><div><span className="font-semibold text-base-content/50">Page</span><div className="break-all font-mono text-xs">{log.page_path || '—'}</div></div><div><span className="font-semibold text-base-content/50">Device</span><div className="break-words text-xs">Online: {String(log.online)} · {log.user_agent || '—'}</div></div>{log.metadata && Object.keys(log.metadata).length > 0 && <details><summary className="cursor-pointer font-semibold text-base-content/50">Metadata</summary><pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-base-200 p-2 text-xs">{JSON.stringify(log.metadata, null, 2)}</pre></details>}</div>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
