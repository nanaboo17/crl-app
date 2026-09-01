'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/components/providers/i18n-provider'
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
  const { t } = useI18n()
  const initials = agentName.trim().slice(0, 2).toUpperCase() || 'SA'

  return (
    <div className="flex h-full flex-col bg-base-100">
      {/* Brand */}
      <div className="flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-base-300 px-5">
        <Image
          src="/logo/logo2.png"
          alt="CRL logo"
          width={48}
          height={32}
          priority
          className="h-8 w-auto object-contain"
        />
        <span className="text-base font-semibold tracking-tight text-base-content">
          {t('nav.brand')}
        </span>
      </div>

      {/* Navigation */}
      <nav
        aria-label={t(config.navAriaKey)}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {config.navGroups.map((group) => (
          <div key={group.labelKey} className="mb-5 last:mb-0">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
              {t(group.labelKey)}
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
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content ${
                        active
                          ? 'bg-primary/10 font-semibold text-primary'
                          : 'font-medium text-base-content/70 hover:bg-base-200 hover:text-base-content'
                      }`}
                    >
                      <Icon
                        aria-hidden="true"
                        className={`h-4 w-4 flex-shrink-0 ${
                          active ? 'text-primary' : 'text-base-content/50'
                        }`}
                      />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User identity */}
      <div className="flex items-center gap-3 border-t border-base-300 px-5 py-4">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-content"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-base-content">
            {agentName}
          </p>
          <p className="text-xs text-base-content/50">{t(`navbar.role.${config.role}`)}</p>
        </div>
      </div>
    </div>
  )
}
