import './globals.css'
import AppProviders from '@/components/providers/AppProviders'

export const metadata = {
  title: 'CRL Field App',
  description: 'Customer Relationship Lead field visit application',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="crl">
      <head>
        <link
          href="https://cdn.jsdelivr.net/npm/daisyui@5"
          rel="stylesheet"
          type="text/css"
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
