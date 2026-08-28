import './globals.css'

export const metadata = {
  title: 'CRL Field App',
  description: 'Customer Relationship Lead field visit application'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
