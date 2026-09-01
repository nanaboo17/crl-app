'use client'

import { Suspense } from 'react'
import VisitForm from './VisitForm'
import { useI18n } from '@/components/providers/i18n-provider'

export default function NewVisitPage() {
  const { t } = useI18n()
  return (
    <Suspense fallback={<main className="container">{t('agent.visitsNew.loading')}</main>}>
      <VisitForm />
    </Suspense>
  )
}
