'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import { CrlRecoveryIllustration } from '@/components/illustrations/CrlIllustrations'

export default function LoginPage() {
  const { t, locale } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSessionExpired(params.get('reason') === 'session_expired')
    const authError = params.get('error')
    if (authError) setError(authError)
  }, [])

  async function signInGoogle() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const params = new URLSearchParams(window.location.search)
    const requestedNext = params.get('next')
    const safeNext = requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : null
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (safeNext) callbackUrl.searchParams.set('next', safeNext)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return <main className="auth-shell">
    <div className="auth-layout">
      <aside className="auth-context" aria-label={t('auth.shell.ariaLabel')}>
        <div className="auth-brand">
          <Image
            src="/logo/logo2.png"
            alt={t('auth.logo.alt')}
            width={66}
            height={44}
            priority
            className="h-11 w-auto flex-shrink-0 object-contain"
          />
          <div>
            <div className="auth-brand-name" translate="no">Indosat HiFi</div>
            <div className="auth-brand-subtitle">{t('auth.brand.subtitle')}</div>
          </div>
        </div>
        <div className="auth-illustration-wrap" aria-hidden="true">
          <CrlRecoveryIllustration className="auth-illustration" />
        </div>
        <div className="auth-context-footer">
          <span className="auth-status-dot" aria-hidden="true" />
          {t('auth.shell.footer')}
        </div>
      </aside>

      <section className="auth-card" aria-labelledby="login-heading">
        <div className="auth-eyebrow">{t('auth.card.eyebrow')}</div>
        <h2 id="login-heading">{t('auth.login.title')}</h2>
        <p className="auth-copy">{t('auth.login.copy')}</p>
        {sessionExpired && (
          <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm font-semibold" role="status">
            {locale === 'id'
              ? 'Sesi Anda sudah berakhir atau token login tidak lagi valid. Silakan masuk kembali. Setelah login, Anda akan dikembalikan ke halaman sebelumnya.'
              : 'Your session expired or its login token is no longer valid. Please sign in again. After login, you will return to the previous page.'}
          </div>
        )}
        <button className="btn" onClick={signInGoogle} disabled={loading} aria-busy={loading}>
          <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.35 12.27c0-.78-.07-1.53-.2-2.24H12v4.24h5.23a4.47 4.47 0 0 1-1.94 2.93v2.75h3.14c1.84-1.69 2.92-4.18 2.92-7.68Z" />
            <path fill="#34A853" d="M12 21.75c2.62 0 4.82-.87 6.43-2.36l-3.14-2.75c-.87.58-1.99.92-3.29.92-2.52 0-4.66-1.7-5.42-3.99H3.33v2.84A9.71 9.71 0 0 0 12 21.75Z" />
            <path fill="#FBBC05" d="M6.58 13.57a5.84 5.84 0 0 1 0-3.72V7.01H3.33a9.75 9.75 0 0 0 0 9.4l3.25-2.84Z" />
            <path fill="#EA4335" d="M12 5.86c1.42 0 2.7.49 3.71 1.44l2.78-2.78C16.81 2.95 14.62 2 12 2a9.71 9.71 0 0 0-8.67 5.01l3.25 2.84C7.34 7.56 9.48 5.86 12 5.86Z" />
          </svg>
          <span>{loading ? t('auth.button.opening') : t('auth.button.google')}</span>
        </button>
        <p className="auth-note">{t('auth.login.note')}</p>
        {error && <div className="inline-error" role="alert">{error}</div>}
      </section>
    </div>
  </main>
}
