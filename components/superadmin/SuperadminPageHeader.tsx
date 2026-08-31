import Link from 'next/link'

export type Crumb = {
  label: string
  /** Omit for the current page — rendered as plain non-clickable text. */
  href?: string
}

/**
 * Shared page-header pattern for the Superadmin content area:
 * breadcrumb → title → short description → optional actions.
 * Server-safe (no client behavior).
 */
export default function SuperadminPageHeader({
  breadcrumbs,
  title,
  description,
  actions,
}: {
  breadcrumbs: Crumb[]
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="space-y-2">
      <nav aria-label="Breadcrumb">
        <ul className="breadcrumbs text-sm">
          {breadcrumbs.map((crumb) => (
            <li key={crumb.label}>
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-base-content/60 transition-colors hover:text-base-content"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-semibold text-base-content">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-base-content sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-base-content/60">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  )
}
