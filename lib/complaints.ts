import 'server-only'

export type ComplaintTicket = {
  no: string
  timestamp: string
  billingId: string
  issueType: string
  custName: string
  caseDetail: string
  city: string
  ticketNumber: string
  status: string
  remarks: string
  agent: string
  callStatus: string
}

const DEFAULT_COMPLAINT_API_URL =
  'https://script.google.com/macros/s/AKfycbyjo6ii7NTISz_arwp2xuqi_OQ7mUn9ui6K2tqBBIovm-5r02bgTKFejq_veWmfv-ue/exec'

export async function getComplaintTickets(billingIds: string[]): Promise<ComplaintTicket[]> {
  const ids = Array.from(new Set(
    billingIds.map((value) => String(value || '').trim()).filter(Boolean)
  ))

  if (ids.length === 0) return []

  const url = new URL(process.env.COMPLAINT_API_URL || DEFAULT_COMPLAINT_API_URL)
  url.searchParams.set('api', 'tickets')
  url.searchParams.set('billingIds', ids.join(','))

  const apiKey = process.env.COMPLAINT_API_KEY?.trim()
  if (apiKey) url.searchParams.set('key', apiKey)

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`Complaint API returned HTTP ${response.status}`)
  }

  const payload = await response.json() as {
    success?: boolean
    tickets?: ComplaintTicket[]
    message?: string
  }

  if (!payload.success) {
    throw new Error(payload.message || 'Unable to load complaint tickets.')
  }

  return Array.isArray(payload.tickets) ? payload.tickets : []
}
