'use client'

import { useEffect } from 'react'
import styles from './error.module.css'

type AppErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error('CRL route error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
    })
  }, [error])

  return (
    <main className={styles.page}>
      <section className={styles.card} role="alert">
        <span className={styles.eyebrow}>CRL recovery</span>
        <h1>Something went wrong</h1>
        <p>
          The page could not be loaded. Retry the request first. If the issue continues,
          share the reference code below so the server log can be matched quickly.
        </p>
        {error.digest && (
          <div className={styles.digest}>
            <span>Reference code</span>
            <strong>{error.digest}</strong>
          </div>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={reset}>
            Try again
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a className={styles.linkButton} href="/auth/route">
            Return to dashboard
          </a>
        </div>
      </section>
    </main>
  )
}
