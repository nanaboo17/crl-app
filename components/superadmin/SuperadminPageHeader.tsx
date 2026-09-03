import Link from 'next/link'
import {
  Building2,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  MapPinned,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Crumb = {
  label: string
  /** Omit for the current page — rendered as plain non-clickable text. */
  href?: string
  /** Optional leading icon shown before the label. */
  icon?: LucideIcon
}

function inferCrumbIcon(crumb: Crumb, isLast: boolean): LucideIcon | undefined {
  if (crumb.icon) return crumb.icon

  const href = crumb.href ?? ''
  if (href === '/superadmin') return ShieldCheck
  if (href.includes('/agents')) return Users
  if (href.includes('/customers')) return Building2
  if (href.includes('/pre-visits')) return ClipboardList
  if (href.includes('/visits')) return MapPin
  if (href.includes('/territories')) return MapPinned

  if (isLast) return LayoutDashboard
  return undefined
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
        <ol className="flex flex-wrap items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1
            const Icon = inferCrumbIcon(crumb, isLast)

            return (
              <li key={`${crumb.href ?? 'current'}-${crumb.label}`} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 text-base-content/30"
                  />
                ) : null}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="inline-flex items-center gap-1.5 text-base-content/60 transition-colors hover:text-base-content"
                  >
                    {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className="inline-flex items-center gap-1.5 font-semibold text-base-content"
                  >
                    {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                    {crumb.label}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
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
