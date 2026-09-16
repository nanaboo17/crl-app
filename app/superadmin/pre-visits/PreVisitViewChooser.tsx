'use client'

import Link from 'next/link'
import { CalendarDays, Users } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function PreVisitViewChooser() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isRoot = pathname === '/superadmin/pre-visits'
  const hasAgentViewState = searchParams.has('filter') || searchParams.has('page') || searchParams.get('mode') === 'agent'

  if (!isRoot || hasAgentViewState) return null

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="previsit-view-title" className="w-full max-w-xl rounded-3xl border border-base-300 bg-base-100 p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-secondary/15 text-secondary"><CalendarDays className="size-7" /></div>
          <h2 id="previsit-view-title" className="text-2xl font-black">Choose Pre-Visit View</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-base-content/60">Review all Pre-Visits for one date, or continue with the existing agent-based monitor.</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/superadmin/pre-visits/date" className="group rounded-2xl border border-base-300 bg-base-100 p-5 transition hover:border-primary hover:bg-primary/5">
            <CalendarDays className="mb-3 size-6 text-primary" />
            <div className="font-black">View by Date</div>
            <div className="mt-1 text-xs leading-5 text-base-content/60">Choose a WIB date, see every Supabase Pre-Visit field, and generate a CSV report.</div>
          </Link>
          <Link href="/superadmin/pre-visits?mode=agent&filter=all&page=1" className="group rounded-2xl border border-base-300 bg-base-100 p-5 transition hover:border-secondary hover:bg-secondary/5">
            <Users className="mb-3 size-6 text-secondary" />
            <div className="font-black">View by Agent</div>
            <div className="mt-1 text-xs leading-5 text-base-content/60">Use the current agent monitor, filters, daily activity, and record details.</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
