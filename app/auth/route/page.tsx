'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { rolePath } from '@/lib/role'
import { useI18n } from '@/components/providers/i18n-provider'

export default function AuthRoutePage() {
  const router = useRouter()
  const { t } = useI18n()

  const [message, setMessage] = useState(
    t('auth.route.checking')
  )

  useEffect(() => {
    const run = async () => {
      const supabase = createClient()

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      console.log('AUTH USER:', user)
      console.log('AUTH ERROR:', userError)

      if (!user?.email) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase
        .from('agents')
        .select('role, active, email')
        .ilike('email', user.email.trim())
        .maybeSingle()

      console.log('LOGIN EMAIL:', user.email)
      console.log('AGENT DATA:', data)
      console.log('AGENT QUERY ERROR:', error)

      if (error) {
        setMessage(t('auth.error.database', { message: error.message }))
        return
      }

      if (!data) {
        setMessage(
          t('auth.error.notRegistered', { email: user.email })
        )

        await supabase.auth.signOut()
        return
      }

      if (!data.active) {
        setMessage(
          t('auth.error.inactive')
        )

        await supabase.auth.signOut()
        return
      }

      router.replace(rolePath(data.role))
    }

    run()
  }, [router])

  return (
    <main className="auth-shell">
      <div className="card loading-card">
        <div className="spinner" />
        <span>{message}</span>
      </div>
    </main>
  )
}