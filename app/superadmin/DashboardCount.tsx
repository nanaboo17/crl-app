'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type CountTable = 'agents' | 'customers' | 'pre_visits' | 'visits'

export default function DashboardCount({ table }: { table: CountTable }) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const supabase = createClient()
    let attempt = 0

    async function load() {
      try {
        // Exact PostgREST counts for customers/visits repeatedly evaluate
        // Circle RLS across thousands of rows and can time out indefinitely.
        // Reuse the already-tested Circle-scoped aggregate RPCs.
        let nextCount: number | null = null
        if (table === 'agents') {
          const { count, error } = await supabase.from('agents')
            .select('email', { count: 'exact', head: true }).eq('active', true)
          if (error) throw error
          nextCount = count
        } else if (table === 'customers') {
          const { data, error } = await supabase.rpc('crl_superadmin_customers_page_v1', {
            p_page: 1, p_status: 'all', p_region: 'all', p_lead_email: 'all', p_search: '',
          })
          if (error) throw error
          const payload = data as { totalAll?: number } | null
          nextCount = payload?.totalAll ?? null
        } else {
          const { data, error } = await supabase.rpc('crl_superadmin_activity_summary_v1', {
            p_kind: table,
          })
          if (error) throw error
          const payload = data as { totalPreVisits?: number; totalVisits?: number } | null
          nextCount = table === 'visits' ? payload?.totalVisits ?? null : payload?.totalPreVisits ?? null
        }
        if (stopped) return
        if (nextCount === null || !Number.isFinite(nextCount)) {
          throw new Error('Dashboard aggregate count unavailable')
        }
        setCount(nextCount)
      } catch (error) {
        if (stopped) return
        attempt += 1
        // Retry transient query timeouts without polling aggressively.
        const delay = Math.min(15000, 1500 * 2 ** Math.min(attempt - 1, 4))
        console.warn('Dashboard count retry', table, error)
        retryTimer = setTimeout(load, delay)
      }
    }

    void load()
    return () => {
      stopped = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [table])

  if (count === null) {
    return (
      <strong aria-label="Loading count" role="status" className="inline-flex items-center gap-2">
        <span className="inline-block h-7 w-7 animate-spin rounded-full border-[3px] border-current border-r-transparent opacity-70" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </strong>
    )
  }

  return <strong>{count.toLocaleString('id-ID')}</strong>
}
