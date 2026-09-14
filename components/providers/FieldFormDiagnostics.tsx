'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

type FieldContext = {
  formType: 'previsit' | 'visit'
  customerId: string | null
  pagePath: string
}

function getContext(): FieldContext | null {
  const url = new URL(window.location.href)
  const path = url.pathname

  if (path.includes('/pre-visit')) {
    return {
      formType: 'previsit',
      customerId: url.searchParams.get('customer'),
      pagePath: `${path}${url.search}`,
    }
  }

  const visitMatch = path.match(/\/agent\/customers\/([^/]+)\/visit(?:\/|$)/)
  if (visitMatch) {
    return {
      formType: 'visit',
      customerId: decodeURIComponent(visitMatch[1]),
      pagePath: `${path}${url.search}`,
    }
  }

  return null
}

function safeError(value: unknown) {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack?.slice(0, 6000) || null,
    }
  }
  return { message: String(value), name: null, stack: null }
}

export default function FieldFormDiagnostics() {
  useEffect(() => {
    const context = getContext()
    if (!context) return

    const supabase = createClient()
    const recentlyLogged = new Map<string, number>()

    const log = async (
      stage: string,
      severity: 'info' | 'warning' | 'error',
      message: string,
      metadata: Record<string, unknown> = {}
    ) => {
      const normalizedMessage = message.trim().slice(0, 2000)
      if (!normalizedMessage) return

      const dedupeKey = `${stage}:${normalizedMessage}`
      const now = Date.now()
      const previous = recentlyLogged.get(dedupeKey) || 0
      if (now - previous < 5000) return
      recentlyLogged.set(dedupeKey, now)

      try {
        await supabase.from('field_form_diagnostic_logs').insert({
          customer_id: context.customerId,
          form_type: context.formType,
          stage,
          severity,
          error_message: normalizedMessage,
          page_path: context.pagePath,
          online: navigator.onLine,
          user_agent: navigator.userAgent.slice(0, 1000),
          metadata: {
            ...metadata,
            browser_language: navigator.language,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
          },
        })
      } catch {
        // Diagnostics must never interrupt the field workflow.
      }
    }

    void log('form_open', 'info', `${context.formType} form opened`, {
      referrer_path: document.referrer ? (() => { try { return new URL(document.referrer).pathname } catch { return null } })() : null,
    })

    const onError = (event: ErrorEvent) => {
      const err = safeError(event.error || event.message)
      void log('javascript_error', 'error', err.message, {
        error_name: err.name,
        stack: err.stack,
        filename: event.filename || null,
        line: event.lineno || null,
        column: event.colno || null,
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = safeError(event.reason)
      void log('unhandled_promise', 'error', err.message, {
        error_name: err.name,
        stack: err.stack,
      })
    }

    const onPhotoProcessingError = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {}
      const message = typeof detail.message === 'string' ? detail.message : 'Photo processing failed'
      void log('photo_processing', 'error', message, {
        file_type: detail.file_type ?? null,
        file_size_bytes: detail.file_size_bytes ?? null,
        max_dimension: detail.max_dimension ?? null,
      })
    }

    const onOffline = () => void log('network_state', 'warning', 'Browser went offline')
    const onOnline = () => void log('network_state', 'info', 'Browser came online')

    const scanVisibleErrors = () => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>('[role="alert"], [role="dialog"]'))
      for (const element of elements) {
        const text = element.innerText?.replace(/\s+/g, ' ').trim()
        if (!text) continue
        const severity = element.getAttribute('role') === 'dialog' ? 'warning' : 'error'
        void log('form_message', severity, text, {
          element_role: element.getAttribute('role'),
        })
      }
    }

    const observer = new MutationObserver(() => scanVisibleErrors())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    scanVisibleErrors()

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    window.addEventListener('crl-photo-processing-error', onPhotoProcessingError)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    return () => {
      observer.disconnect()
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('crl-photo-processing-error', onPhotoProcessingError)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return null
}
