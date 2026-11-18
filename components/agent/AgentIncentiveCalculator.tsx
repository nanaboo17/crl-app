'use client'

import { useState } from 'react'
import { Calculator, ChevronDown, ChevronUp, LockKeyhole, Wallet } from 'lucide-react'

type Counts = {
  callSaves: number
  visitSaves: number
  paidUpdates: number
  surveys: number
  bonus: boolean
}

const initial: Counts = { callSaves: 0, visitSaves: 0, paidUpdates: 0, surveys: 0, bonus: false }
const LIMIT = 10000

function formatRupiah(value: number) {
  return 'Rp' + value.toLocaleString('id-ID')
}

function safeCount(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(LIMIT, Math.floor(parsed))) : 0
}

export default function AgentIncentiveCalculator({ evidenceVisits, locale }: { evidenceVisits: number; locale: 'en' | 'id' }) {
  const [expanded, setExpanded] = useState(false)
  const [counts, setCounts] = useState<Counts>(initial)
  const [draftCounts, setDraftCounts] = useState<Partial<Record<Exclude<keyof Counts, 'bonus'>, string>>>({})
  const [visitTarget, setVisitTarget] = useState(330)
  const [disciplineClear, setDisciplineClear] = useState(true)
  const tx = (en: string, id: string) => locale === 'id' ? id : en

  const unlock = Math.ceil(visitTarget / 2)
  const visitGate = evidenceVisits >= unlock
  const callTotal = counts.callSaves * 20000
  const visitTotal = counts.visitSaves * 50000
  const paidTotal = counts.paidUpdates * 20000
  const surveyTotal = counts.surveys * 30000
  const eligibleMain = callTotal + visitTotal + paidTotal
  const racing = counts.bonus && visitGate && disciplineClear ? 500000 : 0
  const unlockedMain = visitGate && disciplineClear ? eligibleMain : 0
  const potential = eligibleMain + surveyTotal + (counts.bonus ? 500000 : 0)
  const qualifyingSimulation = unlockedMain + surveyTotal + racing
  const missing = Math.max(0, unlock - evidenceVisits)

  const fields: { key: Exclude<keyof Counts, 'bonus'>; label: string; value: number }[] = [
    { key: 'callSaves', label: tx('Saved after connected call', 'Pelanggan bayar setelah ditelepon'), value: 20000 },
    { key: 'visitSaves', label: tx('Saved after valid visit', 'Pelanggan bayar setelah dikunjungi'), value: 50000 },
    { key: 'paidUpdates', label: tx('Already paid + data update', 'Pelanggan sudah bayar + pembaruan data'), value: 20000 },
    { key: 'surveys', label: tx('Completed valid surveys', 'Survei berhasil diselesaikan'), value: 30000 },
  ]

  return (
    <section className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm sm:p-6" aria-label={tx('Incentive calculator simulation', 'Simulasi Perhitungan Insentif')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Wallet className="h-5 w-5" aria-hidden="true" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{tx('Incentive Wallet · Simulation', 'Dompet Insentif · Simulasi')}</p>
            <h2 className="mt-1 text-xl font-bold">{tx('How much could I earn?', 'Berapa potensi insentifku?')}</h2>
            <p className="mt-1 text-xs text-base-content/65">{tx('Enter verified customer counts to test the proposed scheme.', 'Masukkan jumlah pelanggan yang memenuhi syarat untuk mencoba skema insentif.')}</p>
          </div>
        </div>
        <span className="dui-badge dui-badge-warning dui-badge-outline">{tx('Not a payment balance', 'Bukan saldo pembayaran')}</span>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl bg-primary/5 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-base-content/65">{tx('Potential total · Your input', 'Total potensi · Input kamu')}</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{formatRupiah(potential)}</p>
          <p className="mt-1 text-xs text-base-content/60">{tx('No financial amount is verified by billing here.', 'Tidak ada nominal yang diverifikasi billing di sini.')}</p>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-100 p-3">
          <div className="flex items-center gap-2 font-bold">
            <LockKeyhole className="h-4 w-4 text-primary" aria-hidden="true"/>
            {visitGate ? tx('Visit milestone reached', 'Target minimal kunjungan tercapai') : tx('Commission milestone pending', 'Target minimal komisi belum tercapai')}
          </div>
          <p className="mt-2 text-sm">{visitGate
            ? tx('Visit count reaches the proposed minimum. Final validation and discipline checks still apply.', 'Jumlah visit mencapai batas usulan. Validasi akhir dan disiplin tetap berlaku.')
            : tx(`Need ${missing} more visits with GPS and photo to reach the proposed milestone.`, `Perlu ${missing} kunjungan dengan GPS dan foto lagi untuk milestone usulan.`)}</p>
          <p className="mt-2 text-xs text-base-content/55">{evidenceVisits} / {unlock} · {tx('preview visits', 'kunjungan tercatat (belum diverifikasi akhir)')}</p>
        </div>
      </div>

      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="dui-btn dui-btn-outline mt-4 w-full justify-between gap-2">
        <span className="flex items-center gap-2"><Calculator className="h-4 w-4" aria-hidden="true"/>{tx('Try incentive calculation', 'Coba hitung insentif')}</span>
        {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true"/> : <ChevronDown className="h-4 w-4" aria-hidden="true"/>}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-base-content/60">{tx('Only enter distinct eligible customers. For one customer, choose the single highest qualifying main commission; never count both call and visit saves. Re-Engagement does not create an extra commission.', 'Masukkan jumlah pelanggan unik yang memenuhi syarat. Satu pelanggan hanya boleh mendapat satu komisi utama tertinggi; jangan hitung pelanggan yang sama untuk komisi telepon dan kunjungan. Re-Engagement tidak memberikan komisi tambahan.')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(field => (
              <label key={field.key} className="rounded-xl border border-base-300 p-3">
                <span className="block text-sm font-semibold">{field.label}</span>
                <span className="mt-0.5 block text-xs text-base-content/60">{formatRupiah(field.value)} / {tx('customer', 'pelanggan')}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={LIMIT}
                  step={1}
                  value={draftCounts[field.key] ?? String(counts[field.key])}
                  onChange={event => {
                    const value = event.target.value
                    setDraftCounts(prev => ({ ...prev, [field.key]: value }))
                    setCounts(prev => ({ ...prev, [field.key]: safeCount(value) }))
                  }}
                  onBlur={() => setDraftCounts(prev => {
                    const next = { ...prev }
                    delete next[field.key]
                    return next
                  })}
                  className="dui-input dui-input-bordered mt-2 w-full"
                  aria-label={field.label}
                />
              </label>
            ))}
          </div>

          <div className="rounded-xl border border-base-300 p-3">
            <label className="block text-sm font-semibold" htmlFor="incentive-target">{tx('Monthly visit target (default 330)', 'Target kunjungan bulanan (standar 330)')}</label>
            <p className="mt-1 text-xs text-base-content/60">{tx('Use your approved prorated target if you started mid-month; do not assume it automatically.', 'Jika mulai di tengah bulan, isi target prorata yang sudah disetujui; tidak dihitung otomatis.')}</p>
            <input id="incentive-target" type="number" inputMode="numeric" min={1} max={1000} value={visitTarget} onChange={event => setVisitTarget(Math.max(1, Math.min(1000, safeCount(event.target.value))))} className="dui-input dui-input-bordered mt-2 w-full sm:max-w-44"/>
          </div>

          <div className="space-y-3 rounded-xl border border-base-300 p-3">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="dui-checkbox dui-checkbox-sm mt-0.5" checked={disciplineClear} onChange={e => setDisciplineClear(e.target.checked)}/>
              <span><strong>{tx('Discipline gate passed (assumption)', 'Memenuhi syarat disiplin (asumsi)')}</strong><span className="mt-1 block text-xs text-base-content/60">{tx('Uncheck to simulate a blocked main commission. The draft discipline gate starts in Dec 2026.', 'Hapus centang untuk simulasi komisi utama terkunci. Dalam draft, aturan disiplin mulai Desember 2026.')}</span></span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="dui-checkbox dui-checkbox-sm mt-0.5" checked={counts.bonus} onChange={e => setCounts(prev => ({ ...prev, bonus: e.target.checked }))}/>
              <span><strong>{tx('Qualified circle Top 2 (+Rp500,000)', 'Masuk 2 besar circle (+Rp500.000)')}</strong><span className="mt-1 block text-xs text-base-content/60">{tx('Manual assumption, not a live leaderboard result.', 'Asumsi manual, bukan hasil leaderboard otomatis.')}</span></span>
            </label>
          </div>

          <div className="space-y-2 rounded-2xl bg-base-200/60 p-4 text-sm">
            <h3 className="font-bold">{tx('Your simulation breakdown', 'Rincian simulasi')}</h3>
            {[
              [tx('Call saves', 'Berhasil bayar setelah telepon'), callTotal],
              [tx('Visit saves', 'Berhasil bayar setelah kunjungan'), visitTotal],
              [tx('Already-paid data updates', 'Pembaruan data pelanggan sudah bayar'), paidTotal],
              [tx('Surveys (independent of unlock)', 'Survei (tidak perlu unlock)'), surveyTotal],
              [tx('Racing bonus', 'Bonus peringkat'), counts.bonus ? 500000 : 0],
            ].map(([label, amount]) => (
              <div key={String(label)} className="flex items-center justify-between gap-3"><span>{label}</span><strong className="tabular-nums">{formatRupiah(Number(amount))}</strong></div>
            ))}
            <div className="border-t border-base-300 pt-3">
              <div className="flex items-center justify-between gap-3 font-bold"><span>{tx('Potential', 'Total potensi')}</span><strong className="tabular-nums">{formatRupiah(potential)}</strong></div>
              <div className="mt-2 flex items-center justify-between gap-3"><span>{tx('Passes simulated gates', 'Memenuhi syarat simulasi')}</span><strong className="tabular-nums">{formatRupiah(qualifyingSimulation)}</strong></div>
            </div>
            <p className="pt-1 text-xs text-base-content/60">{tx('Simulation only. The approval, real payment timestamps, visit validation, no-duplicate rule, survey quota and monthly budget cap have not been applied automatically.', 'Hanya simulasi. Approval, waktu pembayaran nyata, validasi kunjungan, aturan anti-duplikat, kuota survei, dan batas anggaran bulanan belum diperiksa otomatis.')}</p>
          </div>
          <button type="button" onClick={() => { setCounts(initial); setDraftCounts({}); setVisitTarget(330); setDisciplineClear(true) }} className="dui-btn dui-btn-ghost dui-btn-sm">{tx('Reset simulation', 'Reset simulasi')}</button>
        </div>
      )}
    </section>
  )
}
