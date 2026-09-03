'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/components/providers/i18n-provider'

type BackButtonProps = {
  fallbackHref: string
  label?: string
  className?: string
}

export default function BackButton({ fallbackHref, label, className = '' }: BackButtonProps) {
  const router = useRouter()
  const { locale } = useI18n()
  const resolvedLabel = label ?? (locale === 'id' ? 'Kembali' : 'Back')

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={resolvedLabel}
      className={`dui-btn dui-btn-ghost dui-btn-sm min-h-10 gap-2 px-2 sm:px-3 ${className}`.trim()}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{resolvedLabel}</span>
    </button>
  )
}
