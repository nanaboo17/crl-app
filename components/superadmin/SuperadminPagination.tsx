import Link from 'next/link'

const PAGE_SIZE = 10

/**
 * Server-side pagination bar: URL-driven (?page=N), pure Links — no client JS.
 * daisyUI `join` button group with a compact page list for many pages.
 */
export default function SuperadminPagination({
  page,
  pageSize = PAGE_SIZE,
  total,
  basePath,
}: {
  page: number
  pageSize?: number
  total: number
  basePath: string
}) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null

  const current = Math.min(Math.max(1, page), pages)
  const from = (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)

  const items = pageList(current, pages)

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-base-content/60">
        Showing {from}–{to} of {total}
      </p>

      <div className="join">
        {current === 1 ? (
          <span className="btn btn-sm btn-disabled join-item" aria-disabled="true">
            Previous
          </span>
        ) : (
          <Link
            href={`${basePath}?page=${current - 1}`}
            className="btn btn-sm join-item"
            aria-label="Previous page"
          >
            Previous
          </Link>
        )}

        {items.map((item, index) =>
          item === '…' ? (
            <span key={`ellipsis-${index}`} className="btn btn-sm btn-disabled join-item border-none bg-transparent">
              …
            </span>
          ) : item === current ? (
            <span
              key={item}
              aria-current="page"
              className="btn btn-sm btn-primary join-item"
            >
              {item}
            </span>
          ) : (
            <Link
              key={item}
              href={`${basePath}?page=${item}`}
              className="btn btn-sm join-item"
              aria-label={`Page ${item}`}
            >
              {item}
            </Link>
          )
        )}

        {current === pages ? (
          <span className="btn btn-sm btn-disabled join-item" aria-disabled="true">
            Next
          </span>
        ) : (
          <Link
            href={`${basePath}?page=${current + 1}`}
            className="btn btn-sm join-item"
            aria-label="Next page"
          >
            Next
          </Link>
        )}
      </div>
    </nav>
  )
}

/** 1 … (current-1) current (current+1) … last — compact for many pages. */
function pageList(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1)
  }

  const wanted = [1, 2, page - 1, page, page + 1, pages - 1, pages]
  const unique = [...new Set(wanted.filter((n) => n >= 1 && n <= pages))].sort(
    (a, b) => a - b
  )

  const items: (number | '…')[] = []
  let previous = 0
  for (const n of unique) {
    if (n - previous > 1) items.push('…')
    items.push(n)
    previous = n
  }
  return items
}
