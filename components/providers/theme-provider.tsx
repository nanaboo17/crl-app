'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  DATA_THEME,
  isValidTheme,
  THEME_COOKIE,
  THEME_STORAGE_KEY,
  type Theme,
} from '@/lib/theme'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readCookieTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  const match = document.cookie.match(/(?:^|;\s*)crl_theme=([^;]+)/)
  const value = match ? decodeURIComponent(match[1]) : null
  return isValidTheme(value) ? value : 'light'
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme
  children: ReactNode
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  // Apply to the document and mirror to localStorage + cookie. Skip the
  // refresh: theme is purely cosmetic and does not change server markup.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', DATA_THEME[theme])
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`
  }, [theme])

  // Reconcile with the stored preference after mount. Deliberately reads
  // localStorage only now (not during render) to keep server === client.
  useEffect(() => {
    let stored: Theme | null = null
    try {
      const value = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (isValidTheme(value)) stored = value
    } catch {
      /* ignore */
    }
    if (stored && stored !== readCookieTheme() && stored !== theme) {
      setThemeState(stored)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setTheme = (next: Theme) => setThemeState(next)
  const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}