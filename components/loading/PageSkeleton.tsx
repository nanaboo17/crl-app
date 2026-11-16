export default function PageSkeleton({ variant = 'table' }: { variant?: 'table' | 'dashboard' | 'form' }) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8" role="status" aria-label="Loading page">
      <div className="flex items-center gap-2 text-sm text-base-content/60">
        <span className="dui-loading dui-loading-spinner dui-loading-sm" aria-hidden="true" />
        <span>Loading page… / Memuat halaman…</span>
      </div>
      <div className="space-y-3 animate-pulse" aria-hidden="true">
        <div className="h-4 w-32 rounded bg-base-300" />
        <div className="h-8 w-56 max-w-full rounded bg-base-300" />
        <div className="h-4 w-80 max-w-full rounded bg-base-300" />
      </div>
      {variant === 'dashboard' && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-4 rounded-2xl border border-base-300 bg-base-100 p-4">
            <div className="h-4 w-24 animate-pulse rounded bg-base-300" />
            <div className="h-9 w-16 animate-pulse rounded bg-base-300" />
          </div>)}
        </div>
      )}
      {variant === 'form' ? (
        <div className="max-w-3xl space-y-5 rounded-2xl border border-base-300 bg-base-100 p-5" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-base-300" />
            <div className={`w-full animate-pulse rounded bg-base-300 ${i === 3 ? 'h-28' : 'h-11'}`} />
          </div>)}
          <div className="h-11 w-44 animate-pulse rounded bg-base-300" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100" aria-hidden="true">
          <div className="h-12 border-b border-base-300 bg-base-200 p-3"><div className="h-5 w-40 animate-pulse rounded bg-base-300" /></div>
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="flex gap-4 border-b border-base-300 p-4 last:border-b-0">
            <div className="h-5 w-1/4 animate-pulse rounded bg-base-300" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-base-300" />
            <div className="h-5 flex-1 animate-pulse rounded bg-base-300" />
          </div>)}
        </div>
      )}
    </div>
  )
}
