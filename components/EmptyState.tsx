import type { ReactNode } from 'react'

export default function EmptyState({
  title,
  body,
  illustration,
}: {
  title: string
  body: string
  illustration?: ReactNode
}) {
  return (
    <div className="card empty-state">
      {illustration && <div className="empty-state-visual" aria-hidden="true">{illustration}</div>}
      <strong>{title}</strong>
      <p className="muted">{body}</p>
    </div>
  )
}
