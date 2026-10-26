'use client'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Users } from 'lucide-react'
export type WeeklyAgentActivityRow = {agent_email:string;agent_name:string|null;week_start:string;week_end:string;pre_visits:number;visits:number;visit_conversion:number}
type Outcome = {agent_email:string; unique_previsits?:number;unique_met?:number;unique_ptp?:number}
type Payment = {agent_email:string;paid_after_visit:number;paid_after_previsit:number}
type Visited = {agent_email:string;visited_customers:number}
type Props={rows:WeeklyAgentActivityRow[];loading:boolean;locale:'en'|'id';startDate:string;endDate:string;funnel?:Outcome[];payments?:Payment[];visited?:Visited[]}
const PAGE_SIZE=10
const num=(v:unknown)=>Number(v||0)
export default function WeeklyAgentActivity({rows,loading,locale,startDate,endDate,funnel=[],payments=[],visited=[]}:Props){
 const tx=(en:string,id:string)=>locale==='id'?id:en
 const range=(start:string,end:string)=>`${start<startDate?startDate:start} — ${end>endDate?endDate:end}`
 const [week,setWeek]=useState('')
 const [page,setPage]=useState(1)
 const [ranking,setRanking]=useState<'activity'|'recovery'>('activity')
 const [metric,setMetric]=useState<'visits'|'pre_visits'|'paid'|'ptp'|'unique'>('visits')
 const weekOptions=useMemo(()=>{const m=new Map<string,{week_start:string;week_end:string}>();for(const row of rows)if(!m.has(row.week_start))m.set(row.week_start,{week_start:row.week_start,week_end:row.week_end});return [...m.values()].sort((a,b)=>b.week_start.localeCompare(a.week_start))},[rows])
 const filteredRows=useMemo(()=>week?rows.filter(r=>r.week_start===week):rows,[week,rows])
 const totalPages=Math.max(1,Math.ceil(filteredRows.length/PAGE_SIZE))
 const safePage=Math.min(page,totalPages)
 useEffect(()=>setPage(1),[week,rows])
 const weeklyTotals=useMemo(()=>{const m=new Map<string,{start:string;end:string;pv:number;visits:number}>();for(const r of rows){const v=m.get(r.week_start)||{start:r.week_start,end:r.week_end,pv:0,visits:0};v.pv+=num(r.pre_visits);v.visits+=num(r.visits);m.set(r.week_start,v)}return [...m.values()].sort((a,b)=>a.start.localeCompare(b.start))},[rows])
 const chartWeek=week||weekOptions[0]?.week_start||''
 const activityAgents=rows.filter(r=>r.week_start===chartWeek)
 const paymentMap=new Map(payments.map(r=>[r.agent_email.toLowerCase(),r]))
 const funnelMap=new Map(funnel.map(r=>[r.agent_email.toLowerCase(),r]))
 const visitedMap=new Map(visited.map(r=>[r.agent_email.toLowerCase(),r]))
 const agentNames=new Map(rows.map(r=>[r.agent_email.toLowerCase(),r.agent_name||r.agent_email]))
 const recoveryAgents=[...new Set([...paymentMap.keys(),...funnelMap.keys(),...visitedMap.keys()])].map(email=>({email,name:agentNames.get(email)||email,paid:num(paymentMap.get(email)?.paid_after_visit)+num(paymentMap.get(email)?.paid_after_previsit),ptp:num(funnelMap.get(email)?.unique_ptp),unique:num(visitedMap.get(email)?.visited_customers)}))
 const leaderboard=ranking==='activity'?activityAgents.map(r=>({email:r.agent_email,name:r.agent_name||r.agent_email,pv:num(r.pre_visits),visits:num(r.visits),score:metric==='pre_visits'?num(r.pre_visits):num(r.visits)})).sort((a,b)=>b.score-a.score):recoveryAgents.map(r=>({...r,score:metric==='ptp'?r.ptp:metric==='unique'?r.unique:r.paid})).sort((a,b)=>b.score-a.score)
 const points=weeklyTotals.map((v,i)=>({...v,x:weeklyTotals.length===1?300:44+i*(512/(weeklyTotals.length-1))}))
 const max=Math.max(1,...points.flatMap(v=>[v.pv,v.visits]))
 const y=(value:number)=>220-value/max*178
 const line=(key:'pv'|'visits')=>points.map(p=>`${p.x},${y(p[key])}`).join(' ')
 return <>
 <section className="grid gap-4 xl:grid-cols-2">
 <div className="dui-card min-w-0 border border-base-300 bg-base-100 shadow-sm"><div className="dui-card-body gap-4 p-4 sm:p-5">
 <div><div className="flex items-center gap-2 font-bold"><CalendarDays size={20}/>{tx('Weekly Performance Trend','Tren Kinerja Mingguan')}</div><p className="text-xs opacity-60">{tx('Pre-Visits and Visits for the selected report period','Pra-Kunjungan dan Kunjungan selama periode laporan')}</p></div>
 <div className="flex flex-wrap gap-4 text-xs"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-pink-500"/>Pre-Visits</span><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-purple-700"/>Visits</span></div>
 {points.length>0?<div className="w-full"><svg viewBox="0 0 600 258" role="img" aria-label={tx('Line chart of weekly pre-visits and visits','Grafik garis pra-kunjungan dan kunjungan mingguan')} className="h-auto w-full">
 {[0,0.25,0.5,0.75,1].map(t=><g key={t}><line x1="36" x2="580" y1={220-t*178} y2={220-t*178} stroke="currentColor" strokeOpacity=".12"/><text x="30" y={224-t*178} textAnchor="end" fontSize="10" fill="currentColor" opacity=".6">{Math.round(t*max)}</text></g>)}
 <polyline fill="none" stroke="#ed008c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={line('pv')}/><polyline fill="none" stroke="#7c3bc4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={line('visits')}/>
 {points.map((r,i)=><g key={r.start}><circle cx={r.x} cy={y(r.pv)} r="4" fill="#ed008c"><title>{range(r.start,r.end)}: {r.pv} PV</title></circle><circle cx={r.x} cy={y(r.visits)} r="4" fill="#7c3bc4"><title>{range(r.start,r.end)}: {r.visits} Visits</title></circle><text x={r.x} y="242" textAnchor="middle" fontSize="10" fill="currentColor">{i+1}</text></g>)}
 </svg><p className="text-center text-[11px] opacity-60">{tx('Week numbers correspond to rows below','Nomor minggu sesuai baris di bawah')}</p></div>:<p className="py-10 text-sm opacity-60">{tx('No weekly activity','Tidak ada aktivitas mingguan')}</p>}
 <div className="overflow-x-auto"><table className="dui-table dui-table-zebra w-full text-xs"><thead><tr><th>{tx('Week','Minggu')}</th><th className="text-right">PV</th><th className="text-right">Visits</th><th className="text-right">Visits / PV</th></tr></thead><tbody>{weeklyTotals.map((r,i)=><tr key={r.start}><td className="font-medium">{i+1}. {range(r.start,r.end)}</td><td className="text-right">{r.pv.toLocaleString()}</td><td className="text-right">{r.visits.toLocaleString()}</td><td className="text-right">{r.pv>0?(r.visits/r.pv*100).toFixed(1)+'%':'—'}</td></tr>)}</tbody></table></div>
 <p className="text-[11px] opacity-60">{tx('Visit / PV is an activity ratio, not customer cohort conversion. Partial weeks are clipped to your filters.','Visit / PV adalah rasio aktivitas, bukan konversi pelanggan. Minggu parsial mengikuti periode filter.')}</p>
 </div></div>
 <div className="dui-card min-w-0 border border-base-300 bg-base-100 shadow-sm"><div className="dui-card-body gap-4 p-4 sm:p-5">
 <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{tx('Agent Leaderboard','Peringkat Agen')}</h3><p className="text-xs opacity-60">{ranking==='activity'?range(weekOptions.find(w=>w.week_start===chartWeek)?.week_start||startDate,weekOptions.find(w=>w.week_start===chartWeek)?.week_end||endDate):`${startDate} — ${endDate}`}</p></div><div className="flex rounded-lg border border-base-300 p-1 print:hidden"><button className={`rounded-md px-3 py-2 text-xs font-bold ${ranking==='activity'?'bg-primary text-primary-content':''}`} onClick={()=>{setRanking('activity');setMetric('visits')}}>{tx('Activity','Aktivitas')}</button><button className={`rounded-md px-3 py-2 text-xs font-bold ${ranking==='recovery'?'bg-primary text-primary-content':''}`} onClick={()=>{setRanking('recovery');setMetric('paid')}}>{tx('Recovery','Pemulihan')}</button></div></div>
 <label className="flex items-center gap-2 text-xs">{tx('Rank by','Urutkan berdasarkan')}<select value={metric} onChange={e=>setMetric(e.target.value as typeof metric)} className="dui-select dui-select-sm">{ranking==='activity'?<><option value="visits">Visits</option><option value="pre_visits">Pre-Visits</option></>:<><option value="paid">{tx('Paid after activity','Dibayar setelah aktivitas')}</option><option value="ptp">P2P</option><option value="unique">{tx('Unique visited','Kunjungan unik')}</option></>}</select></label>
 <div className="overflow-x-auto"><table className="dui-table dui-table-zebra w-full text-xs sm:text-sm"><thead><tr><th>#</th><th>{tx('Agent','Agen')}</th><th className="text-right">{ranking==='activity'?'PV':'P2P'}</th><th className="text-right">{ranking==='activity'?'Visits':'Paid'}</th><th className="text-right">{tx('Ranking','Peringkat')}</th></tr></thead><tbody>{leaderboard.slice(0,10).map((r,i)=><tr key={r.email}><td className="font-bold">{i+1}</td><td className="font-medium">{r.name}</td><td className="text-right">{ranking==='activity'?'pv' in r?r.pv:0:'ptp' in r?r.ptp:0}</td><td className="text-right">{ranking==='activity'?'visits' in r?r.visits:0:'paid' in r?r.paid:0}</td><td className="text-right font-bold">{r.score}</td></tr>)}</tbody></table></div>
 {leaderboard.length===0&&<p className="text-sm opacity-60">{tx('No results for this selection','Tidak ada data untuk pilihan ini')}</p>}
 <p className="text-[11px] opacity-60">{ranking==='recovery'?tx('Recovery uses distinct P2P and visited customer cases plus payment attribution for the full selected period.','Pemulihan memakai P2P dan pelanggan dikunjungi unik serta atribusi pembayaran untuk seluruh periode laporan.'):tx('Activity counts use the selected week; repeated visits are counted.','Jumlah aktivitas mengikuti minggu terpilih; kunjungan ulang tetap dihitung.')}</p>
 </div></div></section>
 </>
}