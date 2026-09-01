'use client'

import { Suspense } from 'react'
import PreVisitForm from './PreVisitForm'
import { useI18n } from '@/components/providers/i18n-provider'

export default function NewPreVisitPage() {
  const { t } = useI18n()
  return (
    <Suspense fallback={<main className="container">{t('agent.preVisitsNew.loading')}</main>}>
      <PreVisitForm />
    </Suspense>
  )
}
