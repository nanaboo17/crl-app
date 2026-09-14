'use client'

import { useEffect } from 'react'
import {
  AUTH_REFRESH_FAILED_EVENT,
  PENDING_AUTH_DIAGNOSTIC_KEY,
  clearSupabaseBrowserSession,
  createClient,
} from '@/lib/supabase-browser'

const RECOVERY_GUARD_KEY = 'crl:auth-recovery-in-progress'

export default function AuthSessionRecovery() {
  useEffect(() => {
    let disposed = false
    const supabase = createClient()

    const flushPendingDiagnostic = async () => {
      let raw: string | null = null
      try {
        raw = localStorage.getItem(PENDING_AUTH_DIAGNOSTIC_KEY)
      } catch {
        return
      }
      if (!raw) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user || disposed) return

      try {
        const payload = JSON.parse(raw)
        const { error } = await supabase.from('field_form_diagnostic_logs').insert(payload)
        if (!error) localStorage.removeItem(PENDING_AUTH_DIAGNOSTIC_KEY)
      } catch {
        // Keep the record for the next authenticated page load.
      }
    }

    const recover = () => {
      if (disposed) return
      try {
        if (sessionStorage.getItem(RECOVERY_GUARD_KEY) === '1') return
        sessionStorage.setItem(RECOVERY_GUARD_KEY, '1')
      } catch {
        // Continue even when session storage is unavailable.
      }

      clearSupabaseBrowserSession()
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
      window.location.replace(`/login?reason=session_expired&next=${next}`)
    }

    window.addEventListener(AUTH_REFRESH_FAILED_EVENT, recover)

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        try { sessionStorage.removeItem(RECOVERY_GUARD_KEY) } catch {}
        void flushPendingDiagnostic()
      }
    })

    void flushPendingDiagnostic()

    return () => {
      disposed = true
      window.removeEventListener(AUTH_REFRESH_FAILED_EVENT, recover)
      authListener.subscription.unsubscribe()
    }
  }, [])

  return null
}
