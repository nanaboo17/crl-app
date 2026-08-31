'use client'

import { Suspense } from 'react'
import VisitForm from './VisitForm'

export default function NewVisitPage() {
  return (
    <Suspense fallback={<main className="container">Loading visit...</main>}>
      <VisitForm />
    </Suspense>
  )
}
