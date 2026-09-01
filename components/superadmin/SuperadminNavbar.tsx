'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { LogOut, Menu, User } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { superadminConfig, type ShellConfig } from '@/components/shell/config'

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

  return (
    <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
      {/* Mobile: open navigation drawer. Desktop: sidebar already visible. */}
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenNavigation}
        aria-label="Open navigation"
        aria-controls="superadmin-mobile-nav"
        aria-expanded={navigationOpen}
        className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 lg:hidden"
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
        <span className="text-base font-semibold tracking-tight text-gray-900">
          {config.brandLabel}
        </span>
      </span>

      {/* User menu */}
      <div ref={menuRef} className="relative ml-auto">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={`Account menu for ${agentName}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="rounded-full p-1 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
        >
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-full bg-gray-900 text-white"
          >
            <User className="h-4 w-4" />
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="Account"
            className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
          >
            <div className="border-b border-gray-100 px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-gray-900">
                {agentName}
              </p>
              <p className="truncate text-xs text-gray-500">{email}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {config.role}
              </p>
            </div>
            <div className="pt-1">
              <Link
                href={config.home}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
