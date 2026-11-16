'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

type Direction = 'previous' | 'next'

export default function WeeklyAttendanceNavigation({
  previousHref,
  nextHref,
  dateLabel,
}: {
  previousHref: string
  nextHref: string
  dateLabel: string
}) {
  const [loading, setLoading] = useState<Direction | null>(null)
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentUrl = pathname + '?' + searchParams.toString()

  useEffect(() => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
    fallbackTimer.current = null
    setLoading(null)
    return () => { if (fallbackTimer.current) clearTimeout(fallbackTimer.current) }
  }, [currentUrl])

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, direction: Direction) => {
    if (loading) {
      event.preventDefault()
      return
    }
    setLoading(direction)
    const href = direction === 'previous' ? previousHref : nextHref
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
    // If the Next.js RSC transition stalls, request the page directly instead.
    fallbackTimer.current = setTimeout(() => { window.location.assign(href) }, 7000)
  }

  return (
    <nav aria-label="Weekly attendance navigation" className="flex flex-wrap gap-2">
      <Link
        href={previousHref}
        onClick={(event) => handleClick(event, 'previous')}
        aria-disabled={loading !== null}
        aria-busy={loading === 'previous'}
        tabIndex={loading ? -1 : undefined}
        className={`dui-btn dui-btn-outline dui-btn-sm gap-1 ${loading ? 'pointer-events-none opacity-60' : ''}`}
      >
        {loading === 'previous' ? <Loader2 size={16} className="animate-spin" /> : <ChevronLeft size={16} />}
        {loading === 'previous' ? 'Loading...' : 'Previous'}
      </Link>
      <span className="dui-btn dui-btn-ghost dui-btn-sm pointer-events-none">
        <CalendarDays size={16} />
        {dateLabel}
      </span>
      <Link
        href={nextHref}
        onClick={(event) => handleClick(event, 'next')}
        aria-disabled={loading !== null}
        aria-busy={loading === 'next'}
        tabIndex={loading ? -1 : undefined}
        className={`dui-btn dui-btn-outline dui-btn-sm gap-1 ${loading ? 'pointer-events-none opacity-60' : ''}`}
      >
        {loading === 'next' ? 'Loading...' : 'Next'}
        {loading === 'next' ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
      </Link>
    </nav>
  )
}
