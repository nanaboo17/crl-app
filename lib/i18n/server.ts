import { cookies } from 'next/headers'
import { defaultLocale, isValidLocale, type Locale } from './index'

const LOCALE_COOKIE = 'crl_locale'

/**
 * Resolve the active locale for server-rendered pages from the locale cookie
 * (written by the client provider). Falls back to the default locale.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  if (isValidLocale(value)) return value
  return defaultLocale
}
