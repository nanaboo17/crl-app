import { UsersRound } from 'lucide-react'
import styles from './page.module.css'

export default function LoadingCustomers() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading customers">
      <div className="animate-pulse space-y-3 rounded-3xl bg-violet-50 p-6">
        <div className="h-5 w-36 rounded-lg bg-violet-200" />
        <div className="h-8 w-72 max-w-full rounded-lg bg-violet-200" />
        <div className="h-4 w-64 max-w-full rounded-lg bg-violet-100" />
      </div>
      <section className={styles.summaryGrid}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={styles.summaryCard + ' animate-pulse'} aria-hidden="true">
            <div className="h-10 w-10 rounded-xl bg-violet-200" />
            <div className="h-8 w-20 rounded-lg bg-violet-200" />
            <div className="h-4 w-28 rounded bg-violet-100" />
          </div>
        ))}
      </section>
      <section className={styles.rosterSection}>
        <div className="flex items-center gap-3 text-violet-700">
          <UsersRound size={20} className="animate-pulse" />
          <span>Loading customers…</span>
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-r-transparent" aria-hidden="true" />
        </div>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-violet-100 bg-white p-5" aria-hidden="true">
            <div className="h-5 w-52 max-w-full rounded bg-violet-100" />
            <div className="mt-3 h-4 w-72 max-w-full rounded bg-slate-100" />
          </div>
        ))}
      </section>
    </div>
  )
}
