import { cookies } from 'next/headers'
import { isValidTheme, THEME_COOKIE, type Theme } from './theme'

/**
 * Resolve the active theme for server-rendered output from the theme cookie
 * (written by the client provider). Falls back to light.
 */
export async function getTheme(): Promise<Theme> {
  const store = await cookies()
  const value = store.get(THEME_COOKIE)?.value
  return isValidTheme(value) ? value : 'light'
}