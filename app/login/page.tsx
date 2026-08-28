'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function signInGoogle() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/route` }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="brand-mark">CRL</div>
      <div className="muted small">INDOSAT HIFI FIELD OPERATIONS</div>
      <h1 className="auth-title">Customer visit management</h1>
      <p className="muted">Sign in using an email registered by the CRL administrator.</p>
      <button className="btn" onClick={signInGoogle} disabled={loading}>{loading ? 'Opening Google…' : 'Continue with Google'}</button>
      {error && <div className="inline-error">{error}</div>}
    </section>
  </main>
}
