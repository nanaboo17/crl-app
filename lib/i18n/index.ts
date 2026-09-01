export type Locale = 'en' | 'id'

export const defaultLocale: Locale = 'en'

export const locales: Locale[] = ['en', 'id']

export type Entry = { en: string; id: string }

export type Messages = Record<string, Entry>

export function defineMessages(messages: Messages): Messages {
  return messages
}

/**
 * Translate a key for a locale, interpolating `{name}` placeholders with
 * values from `params`. Server-safe (no hooks).
 */
export function translate(
  locale: Locale,
  messages: Messages,
  key: string,
  params?: Record<string, string | number>
): string {
  const entry = messages[key]
  let out = entry ? entry[locale] : key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      out = out.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
    }
  }
  return out
}

export function mergeMessages(...groups: Messages[]): Messages {
  return Object.assign({}, ...groups)
}

const LOCALE_COOKIE = 'crl_locale'

export function isValidLocale(value: string | undefined | null): value is Locale {
  return value === 'en' || value === 'id'
}
