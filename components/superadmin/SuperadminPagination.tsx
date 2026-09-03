import Link from 'next/link'
import { getLocale } from '@/lib/i18n/server'
import { translate, type Locale } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

const PAGE_SIZE = 10

/**
 * Server-side pagination bar: URL-driven (?page=N), pure Links — no client JS.
 * Uses the project's prefixed daisyUI classes and a compact page list.
 */
export default async function SuperadminPagination({
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
  const locale: Locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, allMessages, key, params)

  return (
    <nav
      aria-label={t('pagination.label')}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-center text-sm text-base-content/60 sm:text-left">
        {t('pagination.showing', { from, to, total })}
      </p>

      <div className="flex max-w-full justify-center overflow-x-auto pb-1 sm:justify-end">
        <div className="dui-join whitespace-nowrap">
          {current === 1 ? (
            <span className="dui-btn dui-btn-sm dui-btn-disabled dui-join-item" aria-disabled="true">
              {t('pagination.previous')}
            </span>
          ) : (
            <Link
              href={`${basePath}?page=${current - 1}`}
              className="dui-btn dui-btn-sm dui-join-item"
              aria-label={t('pagination.previousPage')}
            >
              {t('pagination.previous')}
            </Link>
          )}

          {items.map((item, index) =>
            item === '…' ? (
              <span
                key={`ellipsis-${index}`}
                className="dui-btn dui-btn-sm dui-btn-disabled dui-join-item border-none bg-transparent"
                aria-hidden="true"
              >
                …
              </span>
            ) : item === current ? (
              <span
                key={item}
                aria-current="page"
                className="dui-btn dui-btn-sm dui-btn-primary dui-join-item"
              >
                {item}
              </span>
            ) : (
              <Link
                key={item}
                href={`${basePath}?page=${item}`}
                className="dui-btn dui-btn-sm dui-join-item"
                aria-label={t('pagination.pageAria', { page: item })}
              >
                {item}
              </Link>
            )
          )}

          {current === pages ? (
            <span className="dui-btn dui-btn-sm dui-btn-disabled dui-join-item" aria-disabled="true">
              {t('pagination.next')}
            </span>
          ) : (
            <Link
              href={`${basePath}?page=${current + 1}`}
              className="dui-btn dui-btn-sm dui-join-item"
              aria-label={t('pagination.nextPage')}
            >
              {t('pagination.next')}
            </Link>
          )}
        </div>
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
