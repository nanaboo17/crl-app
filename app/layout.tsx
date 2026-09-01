import './globals.css'
import AppProviders from '@/components/providers/AppProviders'
import { getLocale } from '@/lib/i18n/server'
import { getTheme } from '@/lib/theme-server'
import { DATA_THEME } from '@/lib/theme'

export const metadata = {
  title: 'CRL Field App',
  description: 'Customer Relationship Lead field visit application',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()])

  return (
    <html lang={locale} data-theme={DATA_THEME[theme]}>
      <head>
        <link
          href="https://cdn.jsdelivr.net/npm/daisyui@5"
          rel="stylesheet"
          type="text/css"
        />
      </head>
      <body>
        <AppProviders initialLocale={locale} initialTheme={theme}>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}