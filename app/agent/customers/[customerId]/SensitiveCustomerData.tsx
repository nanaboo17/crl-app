'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, LockKeyhole, MapPin, Phone, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

type Props = {
  customerId: string
  agentEmail: string
  locale: string
  contactItems: [string, string | null | undefined][]
  locationItems: [string, string | null | undefined][]
  canStartPreVisit: boolean
  preVisitHref: string
}

export default function SensitiveCustomerData({ customerId, agentEmail, locale, contactItems, locationItems, canStartPreVisit, preVisitHref }: Props) {
  const [unlocked, setUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [error, setError] = useState('')
  const tx = (en: string, id: string) => locale === 'id' ? id : en

  async function unlock() {
    if (unlocking || unlocked) return
    setUnlocking(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.from('customer_data_unlocks').insert({
        customer_id: customerId,
        agent_email: agentEmail,
      })
      if (error) throw error
      setUnlocked(true)
    } catch (err: any) {
      setError(err?.message || tx('Unable to unlock customer data.', 'Tidak dapat membuka data pelanggan.'))
    } finally {
      setUnlocking(false)
    }
  }

  const blurClass = unlocked ? '' : ' select-none blur-[7px] pointer-events-none'

  return (
    <>
      <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold"><LockKeyhole className="h-5 w-5 text-primary" />{tx('Protected customer data', 'Data pelanggan terlindungi')}</h2>
              <p className="mt-1 text-sm text-base-content/60">{tx('Contact and location details are hidden until you unlock them. Every unlock is recorded.', 'Data kontak dan lokasi disembunyikan sampai Anda membukanya. Setiap pembukaan data dicatat.')}</p>
            </div>
            <button type="button" className={`dui-btn ${unlocked ? 'dui-btn-success' : 'dui-btn-primary'}`} onClick={unlock} disabled={unlocking || unlocked}>
              {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : unlocked ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {unlocked ? tx('Data unlocked', 'Data terbuka') : tx('Unlock data', 'Buka data')}
            </button>
          </div>
          {error ? <div className="dui-alert dui-alert-error py-2 text-sm"><span>{error}</span></div> : null}
        </div>
      </section>

      <ProtectedCard title={tx('Contact', 'Kontak')} icon={Phone} items={contactItems} blurClass={blurClass} />
      <ProtectedCard title={tx('Location', 'Lokasi')} icon={MapPin} items={locationItems} blurClass={blurClass} />

      {canStartPreVisit ? (
        <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
          <div className="dui-card-body gap-3">
            {unlocked ? (
              <Link href={preVisitHref} className="dui-btn dui-btn-primary w-full"><ClipboardList className="h-5 w-5" />{tx('Start Pre-Visit', 'Mulai Pra-Kunjungan')}</Link>
            ) : (
              <button type="button" className="dui-btn w-full" disabled><LockKeyhole className="h-5 w-5" />{tx('Unlock data to start Pre-Visit', 'Buka data untuk memulai Pra-Kunjungan')}</button>
            )}
          </div>
        </section>
      ) : null}
    </>
  )
}

function ProtectedCard({ title, icon: Icon, items, blurClass }: { title: string; icon: typeof MapPin; items: [string, string | null | undefined][]; blurClass: string }) {
  return (
    <section className="dui-card border border-base-300 bg-base-100 shadow-sm overflow-hidden">
      <div className="dui-card-body">
        <h2 className="flex items-center gap-2 text-base font-bold"><Icon className="h-5 w-5 text-primary" />{title}</h2>
        <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 transition-all duration-200${blurClass}`} aria-hidden={Boolean(blurClass)}>
          {items.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">{label}</dt>
              <dd className="mt-1 text-sm font-medium break-words">{value === null || value === undefined || value === '' ? '-' : String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
