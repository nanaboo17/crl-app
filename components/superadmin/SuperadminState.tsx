import type { LucideIcon } from 'lucide-react'

type Tone = 'info' | 'success' | 'warning' | 'error'

const toneClass: Record<Tone, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
}

/**
 * Shared empty/loading/error state for the Superadmin content area,
 * built on the daisyUI alert component. Server-safe.
 */
export default function SuperadminState({
  title,
  description,
  icon: Icon,
  tone = 'info',
  action,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  tone?: Tone
  action?: React.ReactNode
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`alert ${toneClass[tone]}`}
    >
      {Icon ? <Icon aria-hidden="true" className="h-5 w-5 flex-shrink-0" /> : null}
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm opacity-80">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  )
}
