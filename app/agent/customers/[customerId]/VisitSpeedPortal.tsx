'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import CustomerSpeedPanel from './CustomerSpeedPanel'

type Props = {
  customerId: string
  currentSpeed: number | null
  initialDownload: number | null
  initialUpload: number | null
}

export default function VisitSpeedPortal(props: Props) {
  const pathname = usePathname()
  const visitPath = `/agent/customers/${encodeURIComponent(props.customerId)}/visit`
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (pathname !== visitPath) return

    const mount = () => {
      const stepTwo = Array.from(document.querySelectorAll('section')).find((section) => {
        const badge = section.querySelector('span.dui-badge')
        return badge?.textContent?.trim() === '2'
      })

      if (!stepTwo) return false

      let target = document.getElementById('visit-speed-fields-host') as HTMLDivElement | null
      if (!target) {
        target = document.createElement('div')
        target.id = 'visit-speed-fields-host'
        target.className = 'dui-card border border-base-300 bg-base-100 shadow-sm'
        stepTwo.insertAdjacentElement('afterend', target)
      }

      setHost(target)
      return true
    }

    if (mount()) return

    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      document.getElementById('visit-speed-fields-host')?.remove()
    }
  }, [pathname, visitPath])

  if (pathname !== visitPath || !host) return null

  return createPortal(
    <div className="dui-card-body gap-4">
      <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
        <span className="dui-badge dui-badge-primary dui-badge-sm">2A</span>
        Speed Information
      </h2>
      <CustomerSpeedPanel {...props} />
    </div>,
    host,
  )
}
