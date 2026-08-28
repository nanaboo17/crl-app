'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  ['/agent', 'Home'],
  ['/agent/customers', 'Customers'],
  ['/agent/pre-visits', 'Pre-Visit'],
  ['/agent/visits', 'Visits'],
]

export default function AgentNav() {
  const pathname = usePathname()
  return <nav className="mobile-bottom-nav" aria-label="Agent navigation">
    {items.map(([href, label]) => (
      <Link key={href} className={pathname === href || (href !== '/agent' && pathname.startsWith(href)) ? 'active' : ''} href={href}>{label}</Link>
    ))}
  </nav>
}
