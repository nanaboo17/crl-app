import type { ReactNode } from 'react'

export default async function CustomerLayout({
  children,
}: {
  children: ReactNode
  params: Promise<{ customerId: string }>
}) {
  return children
}
