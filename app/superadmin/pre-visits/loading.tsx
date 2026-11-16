export default function Loading() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-5 p-4" aria-busy="true">
      <div className="animate-pulse rounded-3xl bg-violet-50 p-6">
        <div className="h-4 w-32 rounded bg-violet-200" />
        <div className="mt-4 h-8 w-64 max-w-full rounded bg-violet-200" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-violet-100" />
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({length:4},(_,i)=>
          <div key={i} className="animate-pulse rounded-2xl bg-violet-50 p-5">
            <div className="h-9 w-16 rounded bg-violet-200" />
            <div className="mt-3 h-4 w-28 rounded bg-violet-100" />
          </div>)}
      </section>
      <section className="space-y-3 rounded-2xl border border-violet-100 p-5">
        <div role="status" className="flex items-center gap-3 text-sm text-violet-700">
          <span className="inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
          Loading records…
        </div>
        {Array.from({length:10},(_,i)=>
          <div key={i} className="h-16 animate-pulse rounded-xl bg-violet-50" aria-hidden="true" />)}
      </section>
    </main>
  )
}
