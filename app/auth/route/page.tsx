'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { rolePath } from '@/lib/role'

export default function AuthRoutePage() {
  const router = useRouter()

  const [message, setMessage] = useState(
    'Checking your CRL account…'
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
        setMessage(`Database error: ${error.message}`)
        return
      }

      if (!data) {
        setMessage(
          `Email ${user.email} is not registered as a CRL user.`
        )

        await supabase.auth.signOut()
        return
      }

      if (!data.active) {
        setMessage(
          'Your CRL account exists but is currently inactive.'
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