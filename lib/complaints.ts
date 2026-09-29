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
  'https://script.google.com/macros/s/AKfycbyCiplosm0JFAZpDeOEl5bBlY2pT3Vg77p9iTr2zc_GASU6eScltkcPSXGlvhmjqOgQ/exec'

export async function getComplaintTickets(billingIds: string[]): Promise<ComplaintTicket[]> {
  const ids = Array.from(new Set(
    billingIds.map((value) => String(value || '').trim()).filter(Boolean)
  ))

  if (ids.length === 0) return []

  const url = process.env.COMPLAINT_API_URL || DEFAULT_COMPLAINT_API_URL
  const apiKey = process.env.COMPLAINT_API_KEY?.trim() || ''

  const response = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    redirect: 'follow',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api: 'tickets',
      billingIds: ids,
      key: apiKey,
    }),
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
