export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'crl_theme'
export const THEME_COOKIE = 'crl_theme'

export const DATA_THEME: Record<Theme, string> = {
  light: 'crl',
  dark: 'crl-dark',
}

export function isValidTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark'
}