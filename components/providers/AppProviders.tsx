'use client'

import { type ReactNode } from 'react'
import { ThemeProvider } from './theme-provider'
import { I18nProvider } from './i18n-provider'
import ImageBitmapFallback from './ImageBitmapFallback'
import FieldFormDiagnostics from './FieldFormDiagnostics'
import AuthSessionRecovery from './AuthSessionRecovery'
import type { Locale } from '@/lib/i18n'
import type { Theme } from '@/lib/theme'

export default function AppProviders({
  children,
  initialLocale,
  initialTheme,
}: {
  children: ReactNode
  initialLocale: Locale
  initialTheme: Theme
}) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <ImageBitmapFallback />
      <AuthSessionRecovery />
      <FieldFormDiagnostics />
      <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
    </ThemeProvider>
  )
}
