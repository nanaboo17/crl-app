'use client'

import { useEffect } from 'react'
import styles from './error.module.css'

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('CRL global error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    })
  }, [error])

  return (
    <html lang="en">
      <body>
        <main className={styles.page}>
          <section className={styles.card} role="alert">
            <span className={styles.eyebrow}>CRL recovery</span>
            <h1>Application error</h1>
            <p>
              CRL hit an unexpected application error. Retry once, then use the reference
              code below to trace the matching Cloudflare server log if the problem remains.
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
                Reload app
              </button>
              <a className={styles.linkButton} href="/login">
                Go to login
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
