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

function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null

  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isValidTheme(value) ? value : null
  } catch {
    return null
  }
}

function readCookieTheme(): Theme | null {
  if (typeof document === 'undefined') return null

  const match = document.cookie.match(/(?:^|;\s*)crl_theme=([^;]+)/)
  const value = match ? decodeURIComponent(match[1]) : null
  return isValidTheme(value) ? value : null
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', DATA_THEME[theme])
  document.documentElement.style.colorScheme = theme

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore storage failures */
  }

  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme
  children: ReactNode
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  // Reconcile the browser preference once mounted. localStorage wins, then
  // cookie, then the server-rendered initial theme.
  useEffect(() => {
    const browserTheme = readStoredTheme() ?? readCookieTheme()

    if (browserTheme && browserTheme !== initialTheme) {
      setThemeState(browserTheme)
      applyTheme(browserTheme)
      return
    }

    applyTheme(initialTheme)
  }, [initialTheme])

  // Every explicit theme change updates the DOM immediately and persists it.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = (next: Theme) => {
    applyTheme(next)
    setThemeState(next)
  }

  const toggleTheme = () => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }

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
