export default function SuperadminLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Page header skeleton */}
      <div className="space-y-2" aria-hidden="true">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-4 w-full max-w-md" />
      </div>

      {/* Table skeleton — keeps the layout stable while data loads */}
      <div
        aria-hidden="true"
        className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4"
      >
        <div className="skeleton h-6 w-full" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-3/4" />
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  )
}
