'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Gauge, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

type Props = {
  customerId: string
  currentSpeed: number | null
  initialDownload: number | null
  initialUpload: number | null
}

function formatMbps(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  return `${Number(value).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Mbps`
}

export default function CustomerSpeedPanel({
  customerId,
  currentSpeed,
  initialDownload,
  initialUpload,
}: Props) {
  const pathname = usePathname()
  const encodedId = encodeURIComponent(customerId)
  const detailPath = `/agent/customers/${encodedId}`
  const visitPath = `${detailPath}/visit`
  const isVisit = pathname === visitPath
  const isDetail = pathname === detailPath

  const [download, setDownload] = useState(initialDownload === null ? '' : String(initialDownload))
  const [upload, setUpload] = useState(initialUpload === null ? '' : String(initialUpload))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const displayDownload = useMemo(() => {
    const value = Number(download)
    return download.trim() && Number.isFinite(value) ? value : null
  }, [download])

  const displayUpload = useMemo(() => {
    const value = Number(upload)
    return upload.trim() && Number.isFinite(value) ? value : null
  }, [upload])

  if (!isVisit && !isDetail) return null

  async function saveSpeedTest() {
    setSaving(true)
    setSaved(false)
    setError('')

    const downloadValue = download.trim() === '' ? null : Number(download)
    const uploadValue = upload.trim() === '' ? null : Number(upload)

    if ((downloadValue !== null && (!Number.isFinite(downloadValue) || downloadValue < 0)) ||
        (uploadValue !== null && (!Number.isFinite(uploadValue) || uploadValue < 0))) {
      setError('Enter valid non-negative Mbps values.')
      setSaving(false)
      return
    }

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        speed_test_download_mbps: downloadValue,
        speed_test_upload_mbps: uploadValue,
      })
      .eq('customer_id', customerId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
  }

  return (
    <section className="mx-auto mt-4 w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-box bg-primary/10 text-primary">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold">Speed Information</div>
            <div className="text-xs text-base-content/55">Current subscribed speed compared with field speed test result.</div>
          </div>
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded-box border border-base-300">
          <div className="border-r border-base-300 bg-base-200/40 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-base-content/50">Speed Current</div>
            <div className="mt-2 text-xl font-black">{formatMbps(currentSpeed)}</div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-base-content/50">Speed Test Result</div>
            {isVisit ? (
              <div className="mt-2 grid gap-2">
                <label className="dui-input dui-input-bordered flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="grow"
                    value={download}
                    onChange={(event) => { setDownload(event.target.value); setSaved(false) }}
                    placeholder="Download"
                  />
                  <span className="text-xs font-semibold opacity-60">Mbps ↓</span>
                </label>
                <label className="dui-input dui-input-bordered flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="grow"
                    value={upload}
                    onChange={(event) => { setUpload(event.target.value); setSaved(false) }}
                    placeholder="Upload"
                  />
                  <span className="text-xs font-semibold opacity-60">Mbps ↑</span>
                </label>
                <button type="button" onClick={saveSpeedTest} disabled={saving} className="dui-btn dui-btn-outline dui-btn-sm w-full gap-2">
                  {saving ? <span className="dui-loading dui-loading-spinner dui-loading-xs" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving…' : 'Save Speed Test'}
                </button>
                {saved && <div className="text-xs font-semibold text-success">Speed test result saved.</div>}
                {error && <div className="text-xs font-semibold text-error">{error}</div>}
              </div>
            ) : (
              <div className="mt-2 text-sm font-bold leading-6">
                {formatMbps(displayDownload)} <span className="font-medium text-base-content/55">(download)</span><br />
                {formatMbps(displayUpload)} <span className="font-medium text-base-content/55">(upload)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
