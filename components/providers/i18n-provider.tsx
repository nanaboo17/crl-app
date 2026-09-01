'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  defaultLocale,
  isValidLocale,
  translate,
  type Locale,
} from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

const STORAGE_KEY = 'crl_locale'
const LOCALE_COOKIE = 'crl_locale'

export type Translate = (
  key: string,
  params?: Record<string, string | number>
) => string

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translate
}

const I18nContext = createContext<I18nContextValue | null>(null)

function readCookieLocale(): Locale {
  if (typeof document === 'undefined') return defaultLocale
  const match = document.cookie.match(/(?:^|;\s*)crl_locale=([^;]+)/)
  const value = match ? decodeURIComponent(match[1]) : null
  return isValidLocale(value) ? value : defaultLocale
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: ReactNode
}) {
  const router = useRouter()
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  // Persist to localStorage and mirror to the cookie (so server components
  // render this locale), then refresh only when the cookie actually changed —
  // this skips the first paint where cookie === initialLocale.
  useEffect(() => {
    document.documentElement.lang = locale
    try {
      window.localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      /* ignore */
    }
    const previous = readCookieLocale()
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
    if (previous !== locale) {
      router.refresh()
    }
  }, [locale, router])

  // Reconcile with the stored preference after mount. Reads localStorage only
  // now (not during render) so the server-rendered HTML matches the client's
  // first render exactly (no hydration mismatch).
  useEffect(() => {
    let stored: Locale | null = null
    try {
      const value = window.localStorage.getItem(STORAGE_KEY)
      if (isValidLocale(value)) stored = value
    } catch {
      /* ignore */
    }
    if (stored && stored !== locale) {
      setLocaleState(stored)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback((next: Locale) => {
    setLocaleState((current) => {
      if (current === next) return current
      return next
    })
  }, [])

  const t = useCallback<Translate>(
    (key, params) => translate(locale, allMessages, key, params),
    [locale]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}