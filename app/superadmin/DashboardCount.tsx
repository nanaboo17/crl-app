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
        // Supabase RLS applies to each count; never substitute global totals.
        const query = supabase.from(table).select('*', { count: 'exact', head: true })
        const result = table === 'agents' ? await query.eq('active', true) : await query
        if (stopped) return
        if (result.error || result.count == null) {
          throw new Error(result.error?.message || 'Count unavailable')
        }
        setCount(result.count)
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
