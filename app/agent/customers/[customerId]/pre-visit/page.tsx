import PreVisitForm from '@/app/agent/pre-visits/new/PreVisitForm'

export default async function CustomerPreVisitPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params

  return <PreVisitForm customerId={decodeURIComponent(customerId)} />
}
