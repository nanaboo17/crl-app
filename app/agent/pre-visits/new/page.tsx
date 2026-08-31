'use client'

import { Suspense } from 'react'
import PreVisitForm from './PreVisitForm'

export default function NewPreVisitPage() {
  return (
    <Suspense fallback={<main className="container">Loading pre-visit...</main>}>
      <PreVisitForm />
    </Suspense>
  )
}
