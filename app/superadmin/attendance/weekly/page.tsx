import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'

const TIMEZONE = 'Asia/Jakarta'
type Status = 'on_time' | 'late' | 'sick' | 'permission' | 'pending' | 'not_checked_in' | 'unscheduled'
type Agent = { email: string; agent_name: string | null; organization: string | null }
type Attendance = { agent_email: string; attendance_date: string; check_in_at: string | null; check_in_status: string | null }
type Leave = { agent_email: string; request_type: string; status: string; start_date: string; end_date: string }
const colors: Record<Status, string> = {
  on_time: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  late: 'bg-amber-100 text-amber-900 ring-amber-200',
  sick: 'bg-violet-100 text-violet-900 ring-violet-200',
  permission: 'bg-sky-100 text-sky-900 ring-sky-200',
  pending: 'bg-yellow-100 text-yellow-900 ring-yellow-200',
  not_checked_in: 'bg-rose-100 text-rose-900 ring-rose-200',
  unscheduled: 'bg-base-200 text-base-content/55 ring-base-300',
}
const labels: Record<Status,string> = {
  on_time: 'On Time', late: 'Late', sick: 'SICK', permission: 'PERMISSION',
  pending: 'PENDING', not_checked_in: 'Not Checked In', unscheduled: '—',
}
function dateKey(value:Date){ return new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(value) }
function addDays(key:string,n:number){const d=new Date(key+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function monday(key:string){const d=new Date(key+'T00:00:00Z');const day=d.getUTCDay();return addDays(key,-(day===0?6:day-1))}
function formatDate(key:string){return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(key+'T00:00:00Z'))}
function clock(value:string){return new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:TIMEZONE}).format(new Date(value))}
function dayStatus(date:string,today:string,attendance:Attendance|undefined,leaves:Leave[]): {status:Status;value:string;hint:string} {
  if(attendance?.check_in_at) {
    const isLate=attendance.check_in_status?.trim().toLowerCase()==='late'
    const status:Status=isLate?'late':'on_time'
    return {status,value:clock(attendance.check_in_at),hint:labels[status]+' · '+clock(attendance.check_in_at)+' WIB'}
  }
  const approved=leaves.find(l=>l.status==='approved'&&l.start_date<=date&&l.end_date>=date)
  if(approved){const status:Status=approved.request_type==='sick'?'sick':'permission';return {status,value:labels[status],hint:'Approved '+labels[status]}}
  if(leaves.some(l=>l.status==='pending'&&l.start_date<=date&&l.end_date>=date))return {status:'pending',value:'PENDING',hint:'Leave request awaiting approval'}
  const weekday=new Date(date+'T00:00:00Z').getUTCDay()
  if(date>today||weekday===0||weekday===6)return {status:'unscheduled',value:'—',hint:date>today?'Upcoming':'Weekend / non-working day (default)'}
  return {status:'not_checked_in',value:'Not Checked In',hint:'No check-in or approved leave'}
}
export default async function WeeklySuperadminAttendance({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams
  const today=dateKey(new Date())
  const raw=typeof params.week==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(params.week)?params.week:today
  const start=monday(raw)
  const end=addDays(start,6)
  const days=Array.from({length:7},(_,i)=>addDays(start,i))
  const organization=typeof params.organization==='string'?params.organization.trim():''
  const sb=await createClient()
  const {data:{user}}=await sb.auth.getUser()
  if(!user?.email)redirect('/login')
  const {data:profile}=await sb.from('agents').select('role,active').ilike('email',user.email).maybeSingle()
  if(!profile?.active||profile.role!=='superadmin')redirect('/auth/route')
  const [agentsResult,attendanceResult,leaveResult]=await Promise.all([
    sb.from('agents').select('email,agent_name,organization').eq('role','agent').eq('active',true).order('agent_name'),
    sb.from('agent_attendance').select('agent_email,attendance_date,check_in_at,check_in_status').gte('attendance_date',start).lte('attendance_date',end),
    sb.from('agent_leave_requests').select('agent_email,request_type,status,start_date,end_date').lte('start_date',end).gte('end_date',start).in('status',['pending','approved']),
  ])
  const error=agentsResult.error||attendanceResult.error||leaveResult.error
  if(error)throw new Error('Unable to load weekly attendance: '+error.message)
  const agents=(agentsResult.data||[]) as Agent[]
  const attendance=(attendanceResult.data||[]) as Attendance[]
  const leaves=(leaveResult.data||[]) as Leave[]
  const organizations=Array.from(new Set(agents.map(a=>(a.organization||'').trim()).filter(Boolean))).sort()
  const selected=organization?agents.filter(a=>(a.organization||'').trim()===organization):agents
  const byAttendance=new Map(attendance.map(a=>[a.agent_email.toLowerCase()+'|'+a.attendance_date,a]))
  const byLeave=new Map<string,Leave[]>()
  leaves.forEach(l=>{const k=l.agent_email.toLowerCase();byLeave.set(k,[...(byLeave.get(k)||[]),l])})
  const summaries=selected.map(agent=>{
    const email=agent.email.toLowerCase()
    const cells=days.map(day=>dayStatus(day,today,byAttendance.get(email+'|'+day),byLeave.get(email)||[]))
    const total=(status:Status)=>cells.filter(c=>c.status===status).length
    return {agent,cells,totals:{on_time:total('on_time'),late:total('late'),sick:total('sick'),permission:total('permission'),not_checked_in:total('not_checked_in')}}
  })
  const qs=(week:string)=>`/superadmin/attendance/weekly?week=${week}${organization?'&organization='+encodeURIComponent(organization):''}`
  return <main className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-12 sm:p-6 lg:p-8">
    <SuperadminPageHeader breadcrumbs={[{label:'Superadmin',href:'/superadmin'},{label:'Attendance',href:'/superadmin/attendance'},{label:'Weekly'}]} title="Weekly Attendance Monitoring" description="Ringkasan kehadiran mingguan agent, termasuk Sakit dan Izin yang disetujui."/>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/superadmin/attendance" className="text-sm font-semibold text-primary hover:underline">← Daily Attendance</Link>
      <div className="flex flex-wrap gap-2">
        <Link href={qs(addDays(start,-7))} className="dui-btn dui-btn-outline dui-btn-sm"><ChevronLeft size={16}/> Previous</Link>
        <span className="dui-btn dui-btn-ghost dui-btn-sm pointer-events-none"><CalendarDays size={16}/>{formatDate(start)} – {formatDate(end)}</span>
        <Link href={qs(addDays(start,7))} className="dui-btn dui-btn-outline dui-btn-sm">Next <ChevronRight size={16}/></Link>
      </div>
    </div>
    <form className="flex flex-wrap items-end gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
      <label className="grid gap-1 text-sm font-medium">Week containing<input type="date" name="week" defaultValue={raw} className="dui-input dui-input-bordered"/></label>
      <label className="grid gap-1 text-sm font-medium">Organization<select name="organization" defaultValue={organization} className="dui-select dui-select-bordered"><option value="">All organizations</option>{organizations.map(o=><option key={o}>{o}</option>)}</select></label>
      <button className="dui-btn dui-btn-primary">View week</button>
    </form>
    <div className="flex flex-wrap gap-2 text-xs">
      {(Object.keys(labels) as Status[]).filter(k=>k!=='unscheduled').map(k=><span key={k} className={`rounded-lg px-3 py-1.5 font-semibold ring-1 ${colors[k]}`}>{labels[k]}</span>)}
      <span className={`rounded-lg px-3 py-1.5 ring-1 ${colors.unscheduled}`}>Weekend / Upcoming</span>
    </div>
    <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="border-b border-base-300 p-4"><h2 className="font-semibold">Weekly matrix <span className="text-base-content/60 font-normal">· {selected.length} active agents</span></h2><p className="mt-1 text-xs text-base-content/60">Swipe horizontally on smaller screens. Color and text both indicate status. Check-in records take precedence over leave approvals.</p></div>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[1050px] border-separate border-spacing-0 text-xs sm:text-sm">
          <thead><tr className="bg-base-200 text-base-content/70"><th scope="col" className="sticky left-0 z-20 min-w-48 border-b border-r border-base-300 bg-base-200 p-3 text-left">Agent</th>
            {days.map(day=><th scope="col" key={day} className="min-w-28 border-b border-base-300 p-2 text-center">{formatDate(day)}<div className="text-[10px] font-normal">{new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(new Date(day+'T00:00:00Z'))}</div></th>)}
            <th colSpan={5} className="border-b border-l border-base-300 px-2 py-3 text-center">Weekly totals</th></tr>
          <tr className="bg-base-200/70 text-xs">
            <th className="sticky left-0 z-20 border-b border-r border-base-300 bg-base-200/90" />
            {days.map(day=><th key={day} className="border-b border-base-300" />)}
            {(['on_time','late','sick','permission','not_checked_in'] as const).map(k=>
              <th scope="col" key={k} className={`min-w-24 border-b border-l border-base-300 px-2 py-3 text-center font-semibold ${colors[k]}`}>{labels[k]}</th>
            )}
          </tr></thead>
          <tbody>{summaries.map(({agent,cells,totals})=><tr key={agent.email} className="hover:bg-base-200/30">
            <th scope="row" className="sticky left-0 z-10 max-w-52 border-b border-r border-base-300 bg-base-100 p-3 text-left font-medium"><span className="block truncate">{agent.agent_name||agent.email}</span><span className="block truncate text-[11px] font-normal text-base-content/50" title={agent.email}>{agent.email}</span></th>
            {cells.map((c,i)=><td key={days[i]} className="border-b border-base-300 p-1 text-center"><span title={c.hint} className={`flex min-h-12 items-center justify-center rounded-lg px-1.5 py-2 font-semibold ring-1 ${colors[c.status]}`}>{c.value}</span></td>)}
            {(['on_time','late','sick','permission','not_checked_in'] as const).map(k=><td key={k} title={labels[k]} className={`border-b border-l border-base-300 px-3 text-center font-semibold tabular-nums ${colors[k]}`}>{totals[k]}</td>)}
          </tr>)}</tbody>
          <tfoot><tr className="bg-base-200 text-xs">{Array.from({length:8},(_,i)=><td key={i} className="px-2 py-2">{i===0?'Totals: On Time · Late · Sick · Izin · Missing':''}</td>)}{(['on_time','late','sick','permission','not_checked_in'] as const).map(k=><td key={k} title={labels[k]} className={`border-l border-base-300 p-2 text-center font-bold ${colors[k]}`}>{summaries.reduce((sum,s)=>sum+s.totals[k],0)}</td>)}</tr></tfoot>
        </table>
      </div>
    </section>
    <p className="text-xs text-base-content/55">Late vs On Time follows the stored check_in_status; weekend is treated as unscheduled by default. Pending approvals are not counted as approved leave.</p>
  </main>
}
