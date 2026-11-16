import localFont from 'next/font/local'
import './globals.css'
import './theme-overrides.css'
import './illustrations.css'
import './indosat-font-override.css'
import AppProviders from '@/components/providers/AppProviders'
import { getLocale } from '@/lib/i18n/server'
import { getTheme } from '@/lib/theme-server'
import { DATA_THEME } from '@/lib/theme'

const indosat = localFont({
  src: [
    { path: '../public/fonts/IndosatRegular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/IndosatMedium.woff2', weight: '500 600', style: 'normal' },
    { path: '../public/fonts/IndosatBold.woff2', weight: '700 900', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-indosat',
  fallback: ['Arial', 'sans-serif'],
})

export const metadata = {
  title: 'CRL Field App',
  description: 'Customer Relationship Lead field visit application',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()])

  return (
    <html lang={locale} data-theme={DATA_THEME[theme]} className={indosat.variable} suppressHydrationWarning>
      <body className={indosat.className}>
        <AppProviders initialLocale={locale} initialTheme={theme}>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
