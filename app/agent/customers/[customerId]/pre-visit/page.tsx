'use client'

import { Suspense, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import PreVisitForm from './PreVisitForm'
import { useI18n } from '@/components/providers/i18n-provider'

function CanonicalPreVisitForm() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const customerId = decodeURIComponent(params.customerId as string)
  const queryCustomer = searchParams.get('customer')

  useEffect(() => {
    if (queryCustomer === customerId) return
    router.replace(
      `/agent/customers/${encodeURIComponent(customerId)}/pre-visit?customer=${encodeURIComponent(customerId)}`
    )
  }, [customerId, queryCustomer, router])

  if (queryCustomer !== customerId) return null
  return <PreVisitForm />
}

export default function CustomerPreVisitPage() {
  const { t } = useI18n()

  return (
    <Suspense fallback={<main className="container">{t('agent.preVisitsNew.loading')}</main>}>
      <CanonicalPreVisitForm />
    </Suspense>
  )
}
