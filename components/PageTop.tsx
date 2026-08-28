'use client'
import { useRouter } from 'next/navigation'

export default function PageTop({ title, eyebrow = 'CRL FIELD APP', back = false }: { title: string; eyebrow?: string; back?: boolean }) {
  const router = useRouter()
  return <div className="page-header">
    <div className="page-heading-row">
      {back && <button className="icon-btn" aria-label="Back" onClick={() => router.back()}>‹</button>}
      <div><div className="muted small">{eyebrow}</div><h1 className="page-title">{title}</h1></div>
    </div>
  </div>
}
