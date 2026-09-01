'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { superadminConfig, type NavItem, type ShellConfig } from '@/components/shell/config'

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function SuperadminSidebar({
  agentName,
  onNavigate,
  config = superadminConfig,
}: {
  agentName: string
  onNavigate?: () => void
  config?: ShellConfig
}) {
  const pathname = usePathname()
  const initials = agentName.trim().slice(0, 2).toUpperCase() || 'SA'

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-gray-200 px-5">
        <Image
          src="/logo/logo2.png"
          alt="CRL logo"
          width={48}
          height={32}
          priority
          className="h-8 w-auto object-contain"
        />
        <span className="text-base font-semibold tracking-tight text-gray-900">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav
        aria-label={config.navAriaLabel}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {config.navGroups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 ${
                        active
                          ? 'bg-gray-100 font-semibold text-gray-900'
                          : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon
                        aria-hidden="true"
                        className={`h-4 w-4 flex-shrink-0 ${
                          active ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User identity */}
      <div className="flex items-center gap-3 border-t border-gray-200 px-5 py-4">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gray-900 text-xs font-bold text-white"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {agentName}
          </p>
          <p className="text-xs text-gray-500">{config.role}</p>
        </div>
      </div>
    </div>
  )
}
