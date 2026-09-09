import type { ReactNode } from 'react'
import { CrlSearchIllustration } from '@/components/illustrations/CrlIllustrations'

export default function EmptyState({
  title,
  body,
  illustration,
}: {
  title: string
  body: string
  illustration?: ReactNode
}) {
  const visual = illustration ?? <CrlSearchIllustration />

  return (
    <div className="card empty-state">
      <div className="empty-state-visual" aria-hidden="true">{visual}</div>
      <strong>{title}</strong>
      <p className="muted">{body}</p>
    </div>
  )
}
