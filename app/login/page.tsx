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
    <div className="auth-layout">
      <aside className="auth-context" aria-label="CRL workspace introduction">
        <div className="auth-brand">
          <div className="brand-mark" aria-hidden="true" translate="no">CRL</div>
          <div>
            <div className="auth-brand-name" translate="no">Indosat HiFi</div>
            <div className="auth-brand-subtitle">Field operations</div>
          </div>
        </div>
        <div className="auth-context-content">
          <div className="auth-eyebrow">Customer visit management</div>
          <h1 className="auth-title">Every visit, clear from start to finish.</h1>
          <p>Plan routes, capture updates, and keep every customer visit moving with one shared workspace.</p>
        </div>
        <div className="auth-context-footer">
          <span className="auth-status-dot" aria-hidden="true" />
          Secure workspace for authorised teams
        </div>
      </aside>

      <section className="auth-card" aria-labelledby="login-heading">
        <div className="auth-eyebrow">Secure access</div>
        <h2 id="login-heading">Welcome back</h2>
        <p className="auth-copy">Sign in using an email registered by the CRL administrator.</p>
        <button className="btn" onClick={signInGoogle} disabled={loading} aria-busy={loading}>
          <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.35 12.27c0-.78-.07-1.53-.2-2.24H12v4.24h5.23a4.47 4.47 0 0 1-1.94 2.93v2.75h3.14c1.84-1.69 2.92-4.18 2.92-7.68Z" />
            <path fill="#34A853" d="M12 21.75c2.62 0 4.82-.87 6.43-2.36l-3.14-2.75c-.87.58-1.99.92-3.29.92-2.52 0-4.66-1.7-5.42-3.99H3.33v2.84A9.71 9.71 0 0 0 12 21.75Z" />
            <path fill="#FBBC05" d="M6.58 13.57a5.84 5.84 0 0 1 0-3.72V7.01H3.33a9.75 9.75 0 0 0 0 9.4l3.25-2.84Z" />
            <path fill="#EA4335" d="M12 5.86c1.42 0 2.7.49 3.71 1.44l2.78-2.78C16.81 2.95 14.62 2 12 2a9.71 9.71 0 0 0-8.67 5.01l3.25 2.84C7.34 7.56 9.48 5.86 12 5.86Z" />
          </svg>
          <span>{loading ? 'Opening Google…' : 'Continue with Google'}</span>
        </button>
        <p className="auth-note">Access is limited to registered CRL team members.</p>
        {error && <div className="inline-error" role="alert">{error}</div>}
      </section>
    </div>
  </main>
}
