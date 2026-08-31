import { redirect } from 'next/navigation'

export default async function CustomerPreVisitPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params

  redirect(
    `/agent/pre-visits/new?customer=${encodeURIComponent(
      decodeURIComponent(customerId)
    )}`
  )
}
