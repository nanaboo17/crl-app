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
  const playful = config.role === 'superadmin'

  return (
    <div
      className={`flex h-full flex-col ${
        playful
          ? 'bg-[#fffdf6] text-[#3f3652]'
          : 'bg-base-100 text-base-content'
      }`}
    >
      <div
        className={`flex flex-shrink-0 items-center gap-3 px-5 ${
          playful ? 'h-24 border-b border-[#efe5c8]' : 'h-16 border-b border-base-300'
        }`}
      >
        <div
          className={
            playful
              ? 'grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#f7e8ff] to-[#fff2c9] shadow-sm'
              : ''
          }
        >
          <Image
            src="/logo/logo2.png"
            alt="CRL logo"
            width={playful ? 58 : 48}
            height={playful ? 42 : 32}
            priority
            className={playful ? 'h-10 w-auto object-contain' : 'h-8 w-auto object-contain'}
          />
        </div>
        <div className="min-w-0">
          <span
            className={`block tracking-tight ${
              playful ? 'text-2xl font-black text-[#5b2eb8]' : 'text-base font-semibold text-base-content'
            }`}
          >
            {t('nav.brand')}
          </span>
          {playful ? (
            <span className="block text-xs font-semibold text-[#6d6578]">
              {t(`navbar.role.${config.role}`)}
            </span>
          ) : null}
        </div>
      </div>

      <nav
        aria-label={t(config.navAriaKey)}
        className={`flex-1 overflow-y-auto ${playful ? 'px-4 py-5' : 'px-3 py-4'}`}
      >
        {config.navGroups.map((group) => (
          <div key={group.labelKey} className={playful ? 'mb-6 last:mb-0' : 'mb-5 last:mb-0'}>
            <p
              className={`px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider ${
                playful ? 'text-[#9a8eaa]' : 'text-base-content/50'
              }`}
            >
              {t(group.labelKey)}
            </p>
            <ul className={playful ? 'space-y-2' : 'space-y-1'}>
              {group.items.map((item) => {
                const active = isActive(pathname, item)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={
                        playful
                          ? `flex min-h-12 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d42d8] ${
                              active
                                ? 'border-[#ead9ff] bg-gradient-to-r from-[#f3ebff] to-[#fff7dc] text-[#6233c4] shadow-sm'
                                : 'border-transparent text-[#5a5366] hover:border-[#efe5c8] hover:bg-white hover:text-[#4e2b9f]'
                            }`
                          : `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content ${
                              active
                                ? 'bg-primary/10 font-semibold text-primary'
                                : 'font-medium text-base-content/70 hover:bg-base-200 hover:text-base-content'
                            }`
                      }
                    >
                      <span
                        className={
                          playful
                            ? `grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl ${
                                active ? 'bg-white text-[#6b3fdb] shadow-sm' : 'bg-[#faf6ed] text-[#8d8397]'
                              }`
                            : ''
                        }
                      >
                        <Icon
                          aria-hidden="true"
                          className={`h-4 w-4 flex-shrink-0 ${
                            playful
                              ? ''
                              : active
                                ? 'text-primary'
                                : 'text-base-content/50'
                          }`}
                        />
                      </span>
                      {t(item.labelKey)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={`mx-4 mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 ${
          playful
            ? 'border border-[#efe5c8] bg-white/80 shadow-sm'
            : 'border-t border-base-300 px-1 py-4'
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-xs font-bold ${
            playful
              ? 'bg-gradient-to-br from-[#7b4be8] to-[#a66cff] text-white'
              : 'bg-primary text-primary-content'
          }`}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${playful ? 'text-[#3c3548]' : 'text-base-content'}`}>
            {agentName}
          </p>
          <p className={`text-xs ${playful ? 'text-[#8a8195]' : 'text-base-content/50'}`}>
            {t(`navbar.role.${config.role}`)}
          </p>
        </div>
      </div>
    </div>
  )
}
