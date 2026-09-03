'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function normalize(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function isBackControl(text: string) {
  const lower = text.toLowerCase()
  return lower === 'back' || lower === 'kembali' || lower.startsWith('back to ') || lower.startsWith('kembali ke ')
}

export default function GlobalBackButtonFix() {
  const pathname = usePathname()

  useEffect(() => {
    const apply = () => {
      const controls = document.querySelectorAll<HTMLElement>('a, button')
      controls.forEach((control) => {
        const text = normalize(control.textContent)
        if (!isBackControl(text) || control.dataset.crlBackFixed === 'true') return

        control.dataset.crlBackFixed = 'true'
        control.classList.add(
          'dui-btn',
          'dui-btn-ghost',
          'dui-btn-sm',
          'min-h-10',
          'gap-2',
          'px-2',
          'sm:px-3',
          'whitespace-nowrap'
        )

        if (!control.querySelector('[data-crl-back-icon]') && !text.startsWith('←')) {
          const icon = document.createElement('span')
          icon.dataset.crlBackIcon = 'true'
          icon.setAttribute('aria-hidden', 'true')
          icon.className = 'inline-flex shrink-0 text-base leading-none'
          icon.textContent = '←'
          control.prepend(icon)
        }
      })
    }

    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])

  return null
}
