'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

type Props = {
  customerId: string
  currentSpeed: number | null
  initialDownload: number | null
  initialUpload: number | null
}

function formatMbps(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-'
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

  if (!isVisit && !isDetail) return null

  async function saveSpeedTest() {
    setSaving(true)
    setSaved(false)
    setError('')

    const downloadValue = download.trim() === '' ? null : Number(download)
    const uploadValue = upload.trim() === '' ? null : Number(upload)

    if (
      (downloadValue !== null && (!Number.isFinite(downloadValue) || downloadValue < 0)) ||
      (uploadValue !== null && (!Number.isFinite(uploadValue) || uploadValue < 0))
    ) {
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

  if (isDetail) {
    return (
      <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
        <div className="dui-card-body">
          <div className="space-y-1.5">
            <div className="text-sm font-semibold">Speed Current</div>
            <div className="dui-input dui-input-bordered flex w-full items-center bg-base-200/40 font-medium">
              {formatMbps(currentSpeed)}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <div className="text-sm font-semibold">Speed Current</div>
          <div className="dui-input dui-input-bordered flex w-full items-center bg-base-200/40 font-medium">
            {formatMbps(currentSpeed)}
          </div>
        </div>

        <label className="space-y-1.5">
          <span className="text-sm font-semibold">Speed Test Download</span>
          <label className="dui-input dui-input-bordered flex w-full items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="grow"
              value={download}
              onChange={(event) => {
                setDownload(event.target.value)
                setSaved(false)
              }}
              placeholder="0"
            />
            <span className="text-xs font-semibold opacity-60">Mbps</span>
          </label>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-semibold">Speed Test Upload</span>
          <label className="dui-input dui-input-bordered flex w-full items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="grow"
              value={upload}
              onChange={(event) => {
                setUpload(event.target.value)
                setSaved(false)
              }}
              placeholder="0"
            />
            <span className="text-xs font-semibold opacity-60">Mbps</span>
          </label>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={saveSpeedTest}
          disabled={saving}
          className="dui-btn dui-btn-outline dui-btn-sm gap-2"
        >
          {saving ? <span className="dui-loading dui-loading-spinner dui-loading-xs" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save Speed Test'}
        </button>
        {saved && <span className="text-xs font-semibold text-success">Speed test result saved.</span>}
        {error && <span className="text-xs font-semibold text-error">{error}</span>}
      </div>
    </div>
  )
}
