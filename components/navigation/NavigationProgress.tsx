'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Shared navigation feedback for Agent, Admin and Superadmin.
 * Doesn't interfere with existing asynchronous action handlers.
 */
export default function NavigationProgress() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    setBusy(false)
    setSlow(false)
  }, [pathname, search])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const element = event.target
      if (!(element instanceof Element)) return
      const link = element.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || link.target === '_blank') return
      const target = new URL(link.href, window.location.href)
      if (target.origin !== window.location.origin || !/^https?:$/.test(target.protocol)) return
      if (target.pathname === window.location.pathname && target.search === window.location.search) return
      setBusy(true)
      setSlow(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    if (!busy) return
    const slowTimeout = window.setTimeout(() => setSlow(true), 8000)
    const resetTimeout = window.setTimeout(() => { setBusy(false); setSlow(false) }, 30000)
    return () => { window.clearTimeout(slowTimeout); window.clearTimeout(resetTimeout) }
  }, [busy])

  if (!busy) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100]">
      <div className="h-1 w-full overflow-hidden bg-primary/15">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content shadow-lg" role="status" aria-live="polite">
        <span className="dui-loading dui-loading-spinner dui-loading-xs" aria-hidden="true" />
        {slow ? 'Loading is taking longer… / Memuat lebih lama…' : 'Loading page… / Memuat halaman…'}
      </div>
    </div>
  )
}
