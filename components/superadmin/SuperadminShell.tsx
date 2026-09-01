'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import SuperadminSidebar from './SuperadminSidebar'
import SuperadminNavbar from './SuperadminNavbar'
import {
  adminConfig,
  agentConfig,
  superadminConfig,
  type ShellConfig,
} from '@/components/shell/config'

export default function SuperadminShell({
  agentName,
  email,
  children,
  mode = 'superadmin',
}: {
  agentName: string
  email: string
  children: React.ReactNode
  mode?: 'agent' | 'admin' | 'superadmin'
}) {
  const pathname = usePathname()
  const [navOpen, setNavOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  const config: ShellConfig =
    mode === 'agent'
      ? agentConfig
      : mode === 'admin'
        ? adminConfig
        : superadminConfig

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!navOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setNavOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [navOpen])

  useEffect(() => {
    if (wasOpen.current && !navOpen) menuButtonRef.current?.focus()
    wasOpen.current = navOpen
  }, [navOpen])

  return (
    <div className="min-h-screen bg-base-200">
      <aside
        aria-label={`${config.role} sidebar`}
        className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-base-300 bg-base-100 lg:block"
      >
        <SuperadminSidebar agentName={agentName} config={config} />
      </aside>

      <div
        id="superadmin-mobile-nav"
        className={`fixed inset-0 z-50 lg:hidden ${navOpen ? '' : 'pointer-events-none'}`}
      >
        <div
          aria-hidden="true"
          onClick={() => setNavOpen(false)}
          className={`absolute inset-0 bg-black/50 motion-safe:transition-opacity ${
            navOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          inert={!navOpen}
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-base-100 shadow-xl motion-safe:transition-transform motion-reduce:transition-none ${
            navOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
            className="absolute right-3 top-3.5 z-10 rounded-lg p-2 text-base-content/70 transition-colors hover:bg-base-200 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          <SuperadminSidebar
            agentName={agentName}
            onNavigate={() => setNavOpen(false)}
            config={config}
          />
        </div>
      </div>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <SuperadminNavbar
          agentName={agentName}
          email={email}
          navigationOpen={navOpen}
          onOpenNavigation={() => setNavOpen(true)}
          menuButtonRef={menuButtonRef}
          config={config}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
