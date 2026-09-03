'use client'

import { useEffect, useState } from 'react'
import { MapPinned } from 'lucide-react'
import { useI18n } from '@/components/providers/i18n-provider'
import styles from './FieldModeToggle.module.css'

const STORAGE_KEY = 'crl_superadmin_field_mode'

function applyFieldMode(enabled: boolean) {
  document.documentElement.setAttribute('data-field-mode', enabled ? 'on' : 'off')
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Ignore storage failures; the toggle still works for the current page.
  }
}

export default function FieldModeToggle() {
  const { locale } = useI18n()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let stored = false
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) === 'on'
    } catch {
      stored = false
    }
    setEnabled(stored)
    applyFieldMode(stored)
  }, [])

  function toggle() {
    setEnabled((current) => {
      const next = !current
      applyFieldMode(next)
      return next
    })
  }

  const label = locale === 'id' ? 'Mode Lapangan' : 'Field Mode'
  const title = enabled
    ? locale === 'id'
      ? 'Matikan Mode Lapangan'
      : 'Turn off Field Mode'
    : locale === 'id'
      ? 'Aktifkan Mode Lapangan'
      : 'Turn on Field Mode'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={title}
      title={title}
      className={`${styles.toggle} hidden min-h-11 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-extrabold shadow-sm transition sm:inline-flex`}
    >
      <MapPinned aria-hidden="true" className="h-4 w-4" />
      <span>{label}</span>
      <span aria-hidden="true" className={`${styles.dot} ${enabled ? styles.dotOn : ''}`} />
    </button>
  )
}
