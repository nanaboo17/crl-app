import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase-server'
import VisitSpeedPortal from './VisitSpeedPortal'

export default async function CustomerLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const decodedCustomerId = decodeURIComponent(customerId)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let speed: number | null = null
  let download: number | null = null
  let upload: number | null = null

  if (user?.email) {
    const customerLookupColumn = /^CRL\d{8}$/.test(decodedCustomerId) ? 'crl_id' : 'customer_id'
    const { data } = await supabase
      .from('customers')
      .select('speed,speed_test_download_mbps,speed_test_upload_mbps')
      .eq(customerLookupColumn, decodedCustomerId)
      .ilike('agent_email', user.email.trim())
      .maybeSingle()

    speed = data?.speed == null ? null : Number(data.speed)
    download = data?.speed_test_download_mbps == null ? null : Number(data.speed_test_download_mbps)
    upload = data?.speed_test_upload_mbps == null ? null : Number(data.speed_test_upload_mbps)
  }

  return (
    <>
      {children}
      <VisitSpeedPortal
        customerId={decodedCustomerId}
        currentSpeed={speed}
        initialDownload={download}
        initialUpload={upload}
      />
    </>
  )
}
