'use client'

import { createElement, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { CalendarDays, X } from 'lucide-react'

type Props = {
  basePath: string
  initialStart: string
  initialEnd: string
  startLabel?: string
  endLabel?: string
}

type IonicDatetimeElement = HTMLElement & {
  value?: string | string[] | null
  min?: string
  max?: string
}

type PickerTarget = 'start' | 'end' | null

const IONIC_VERSION = '9.0.3'

export default function IonicDateRangePicker({
  basePath,
  initialStart,
  initialEnd,
  startLabel = 'Start date (WIB)',
  endLabel = 'End date (WIB)',
}: Props) {
  const router = useRouter()
  const datetimeRef = useRef<IonicDatetimeElement | null>(null)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [picker, setPicker] = useState<PickerTarget>(null)

  useEffect(() => {
    if (!picker || !datetimeRef.current) return
    const element = datetimeRef.current
    element.value = picker === 'start' ? start : end
    if (picker === 'start') {
      element.min = undefined
      element.max = end
    } else {
      element.min = start
      element.max = undefined
    }

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ value?: string | string[] | null }>).detail
      const raw = Array.isArray(detail?.value) ? detail.value[0] : detail?.value
      if (!raw || typeof raw !== 'string') return
      const value = raw.slice(0, 10)
      if (picker === 'start') {
        setStart(value)
        if (value > end) setEnd(value)
      } else {
        setEnd(value)
        if (value < start) setStart(value)
      }
      setPicker(null)
    }

    element.addEventListener('ionChange', onChange)
    return () => element.removeEventListener('ionChange', onChange)
  }, [picker, start, end])

  const applyRange = () => {
    const params = new URLSearchParams({ start, end })
    router.push(`${basePath}?${params.toString()}`)
  }

  const datetime = picker
    ? createElement('ion-datetime' as any, {
        ref: (node: IonicDatetimeElement | null) => { datetimeRef.current = node },
        presentation: 'date',
        value: picker === 'start' ? start : end,
        min: picker === 'end' ? start : undefined,
        max: picker === 'start' ? end : undefined,
        'first-day-of-week': 1,
        locale: 'en-GB',
        preferWheel: false,
        style: { width: '100%' },
      })
    : null

  return (
    <>
      <link
        rel="stylesheet"
        href={`https://cdn.jsdelivr.net/npm/@ionic/core@${IONIC_VERSION}/css/ionic.bundle.css`}
      />
      <Script
        id="ionic-core-module"
        type="module"
        src={`https://cdn.jsdelivr.net/npm/@ionic/core@${IONIC_VERSION}/dist/ionic/ionic.esm.js`}
        strategy="afterInteractive"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-base-content/60">{startLabel}</span>
          <button
            type="button"
            onClick={() => setPicker('start')}
            className="dui-btn dui-btn-outline min-w-44 justify-between bg-base-100 font-semibold"
          >
            <span>{start}</span>
            <CalendarDays className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-base-content/60">{endLabel}</span>
          <button
            type="button"
            onClick={() => setPicker('end')}
            className="dui-btn dui-btn-outline min-w-44 justify-between bg-base-100 font-semibold"
          >
            <span>{end}</span>
            <CalendarDays className="size-4" aria-hidden="true" />
          </button>
        </div>

        <button type="button" onClick={applyRange} className="dui-btn dui-btn-secondary">
          <CalendarDays className="size-4" aria-hidden="true" />
          View Range
        </button>
      </div>

      {picker && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-base-content/50">Ionic Date Picker</div>
                <h3 className="text-lg font-black">{picker === 'start' ? 'Select start date' : 'Select end date'}</h3>
              </div>
              <button type="button" onClick={() => setPicker(null)} className="dui-btn dui-btn-ghost dui-btn-sm dui-btn-circle" aria-label="Close date picker">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-3">{datetime}</div>
          </div>
        </div>
      )}
    </>
  )
}
