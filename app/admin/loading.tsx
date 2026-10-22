export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8" role="status" aria-label="Loading page">
      <div className="flex items-center gap-2 text-sm font-medium text-base-content/60">
        <span className="dui-loading dui-loading-spinner dui-loading-sm" aria-hidden="true" />
        Loading page… / Memuat halaman…
      </div>
      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="h-4 w-32 rounded-lg bg-base-300/70" />
        <div className="h-9 w-64 max-w-full rounded-lg bg-base-300/70" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-base-300/70" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({length:4},(_,index)=><div key={index} className="h-24 rounded-xl bg-base-300/60" />)}
        </div>
        <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
          {Array.from({length:5},(_,index)=><div key={index} className="my-3 h-10 rounded-lg bg-base-300/60"/>)}
        </div>
      </div>
    </div>
  )
}
