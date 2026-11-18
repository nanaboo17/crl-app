import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import AgentIncentiveCalculator from '@/components/agent/AgentIncentiveCalculator'

function currentMonthJakarta() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}`
}

export default async function AgentIncentivesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')
  const email = user.email.trim().toLowerCase()
  const { data: agent } = await supabase.from('agents')
    .select('role,active').ilike('email', email).maybeSingle()
  if (!agent?.active || agent.role !== 'agent') redirect('/auth/route')

  const month = currentMonthJakarta()
  const [year, monthNumber] = month.split('-').map(Number)
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7)

  // Preliminary visit evidence count only. This is not a billing-verified
  // commission eligibility or an approved payout calculation.
  const { count, error } = await supabase.from('visits')
    .select('visit_id', { count: 'exact', head: true })
    .eq('agent_email', email)
    .gte('visit_date', `${month}-01T00:00:00+07:00`)
    .lt('visit_date', `${nextMonth}-01T00:00:00+07:00`)
    .eq('location_match', true)
    .not('visit_photo_url', 'is', null)
    .neq('visit_photo_url', '')

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4 pb-12 sm:p-6 lg:p-8">
      <Link href="/agent" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali ke Dashboard
      </Link>
      <header className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Wallet className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Simulasi Insentif</h1>
          <p className="mt-1 text-sm text-base-content/65">Hitung potensi insentif CRL secara terpisah. Angka bukan saldo pembayaran yang sudah disetujui.</p>
        </div>
      </header>
      {error ? (
        <div role="alert" className="dui-alert dui-alert-warning">
          Data kunjungan bulan ini belum dapat dimuat. Coba muat ulang halaman.
        </div>
      ) : <AgentIncentiveCalculator evidenceVisits={count ?? 0} locale="id" />}
      <p className="text-xs text-base-content/55">
        Data kunjungan yang ditampilkan hanya mencakup catatan bulan ini dengan GPS cocok dan foto. 
        Jumlah akhir, target prorata, pembayaran pelanggan, serta hak komisi tetap perlu validasi.
      </p>
    </main>
  )
}
