'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Globe, LogOut, Menu, Moon, Sun, User } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { superadminConfig, type ShellConfig } from '@/components/shell/config'
import { useI18n } from '@/components/providers/i18n-provider'
import { useTheme } from '@/components/providers/theme-provider'

export default function SuperadminNavbar({
  agentName,
  email,
  navigationOpen,
  onOpenNavigation,
  menuButtonRef,
  config = superadminConfig,
}: {
  agentName: string
  email: string
  navigationOpen: boolean
  onOpenNavigation: () => void
  menuButtonRef: React.RefObject<HTMLButtonElement | null>
  config?: ShellConfig
}) {
  const router = useRouter()
  const { locale, setLocale, t } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the user menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return

    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  async function handleLogout() {
    setMenuOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const iconBtn =
    'rounded-lg p-2 text-base-content/70 transition-colors hover:bg-base-200 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content'

  return (
    <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-3 border-b border-base-300 bg-base-100 px-4 sm:px-6 lg:px-8">
      {/* Mobile: open navigation drawer. Desktop: sidebar already visible. */}
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenNavigation}
        aria-label={t('nav.open')}
        aria-controls="superadmin-mobile-nav"
        aria-expanded={navigationOpen}
        className={`${iconBtn} lg:hidden`}
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      {/* Brand only on mobile — desktop brand lives in the sidebar */}
      <span className="flex items-center gap-2 lg:hidden">
        <Image
          src="/logo/logo2.png"
          alt="CRL logo"
          width={27}
          height={18}
          className="h-[18px] w-auto object-contain"
        />
        <span className="text-base font-semibold tracking-tight text-base-content">
          {t('nav.brand')}
        </span>
      </span>

      {/* Toggles + user menu */}
      <div className="ml-auto flex items-center gap-1.5">
        {/* Language toggle */}
        <button
          type="button"
          onClick={() => setLocale(locale === 'id' ? 'en' : 'id')}
          aria-label={locale === 'id' ? t('header.language.en') : t('header.language.id')}
          title={locale === 'id' ? t('header.language.en') : t('header.language.id')}
          className={`${iconBtn} flex items-center gap-1.5 font-semibold`}
        >
          <Globe aria-hidden="true" className="h-4 w-4" />
          <span className="text-xs uppercase">{locale}</span>
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t('header.theme.light') : t('header.theme.dark')}
          title={theme === 'dark' ? t('header.theme.light') : t('header.theme.dark')}
          className={iconBtn}
        >
          {theme === 'dark' ? (
            <Sun aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Moon aria-hidden="true" className="h-5 w-5" />
          )}
        </button>

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t('navbar.accountMenu', { name: agentName })}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="rounded-full p-1 transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content"
          >
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-content"
            >
              <User className="h-4 w-4" />
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label={t('nav.account.label')}
              className="absolute right-0 mt-2 w-64 rounded-xl border border-base-300 bg-base-100 p-2 shadow-lg"
            >
              <div className="border-b border-base-300 px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-base-content">
                  {agentName}
                </p>
                <p className="truncate text-xs text-base-content/60">{email}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
                  {t(`navbar.role.${config.role}`)}
                </p>
              </div>
              <div className="pt-1">
                <Link
                  href={config.home}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-base-content/80 transition-colors hover:bg-base-200 hover:text-base-content"
                >
                  {t('common.dashboard')}
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-error transition-colors hover:bg-error/10"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  {t('common.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
