import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type InputRow = Record<string, unknown>
type CheckedRow = {
  row: number
  customer_id: string
  case_month: string
  status: 'valid' | 'warning' | 'error'
  messages: string[]
  payload?: Record<string, unknown>
  existing?: boolean
}

const text = (value: unknown) => String(value ?? '').trim()
const nullable = (value: unknown) => {
  const valueText = text(value)
  return valueText || null
}
const numberOrNull = (value: unknown) => {
  const valueText = text(value).replace(/,/g, '')
  if (!valueText) return null
  const number = Number(valueText)
  return Number.isFinite(number) ? number : null
}
const priority = (value: unknown) => {
  const clean = text(value).toUpperCase()
  if (!clean) return null
  const match = clean.match(/[1-5]/)
  return match ? `P${match[0]}` : null
}
const payment = (value: unknown) => text(value).toLowerCase() === 'paid' ? 'paid' : 'unpaid'

function normalizeDate(value: unknown) {
  const raw = text(value)
  if (!raw) return null

  const iso = raw.match(/^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})$/)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  const dmy = raw.match(/^(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  const serial = Number(raw)
  if (Number.isFinite(serial) && serial >= 20000 && serial <= 80000) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpoch + Math.floor(serial) * 86400000)
    if (!Number.isNaN(date.getTime())) {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
    }
  }

  return null
}

function normalizeCaseMonth(value: unknown) {
  const raw = text(value)
  if (!raw) return ''

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-01`
    }
  }

  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmy) {
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-01`
    }
  }

  const serial = Number(raw)
  if (Number.isFinite(serial) && serial >= 20000 && serial <= 80000) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const date = new Date(excelEpoch + Math.floor(serial) * 86400000)
    if (!Number.isNaN(date.getTime())) {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
    }
  }

  return ''
}

function caseKey(customerId: string, caseMonth: string) {
  return `${customerId}\u0000${caseMonth}`
}

async function authorize() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return { error: NextResponse.json({ error: 'Please sign in first.' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('agents')
    .select('role,active')
    .ilike('email', user.email.trim())
    .maybeSingle()

  if (!profile?.active || profile.role !== 'superadmin') {
    return { error: NextResponse.json({ error: 'Superadmin access required.' }, { status: 403 }) }
  }

  return { supabase }
}

async function validateRows(supabase: any, rows: InputRow[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      rows: [] as CheckedRow[],
      summary: { total: 0, valid: 0, warnings: 0, errors: 0, existing: 0 },
    }
  }

  if (rows.length > 5000) throw new Error('Maximum 5,000 rows per upload.')

  const normalizedIdentity = rows.map((row) => ({
    customerId: text(row.customer_id),
    caseMonth: normalizeCaseMonth(row.case_month),
  }))

  const duplicateKeys = new Set<string>()
  const seenKeys = new Set<string>()
  for (const item of normalizedIdentity) {
    if (!item.customerId || !item.caseMonth) continue
    const key = caseKey(item.customerId, item.caseMonth)
    if (seenKeys.has(key)) duplicateKeys.add(key)
    seenKeys.add(key)
  }

  const customerIds = Array.from(new Set(normalizedIdentity.map((item) => item.customerId).filter(Boolean)))
  const existingKeys = new Set<string>()
  for (let i = 0; i < customerIds.length; i += 500) {
    const chunk = customerIds.slice(i, i + 500)
    const { data, error } = await supabase
      .from('customers')
      .select('customer_id,case_month')
      .in('customer_id', chunk)

    if (error) throw error

    for (const row of data ?? []) {
      const month = normalizeCaseMonth(row.case_month)
      if (row.customer_id && month) existingKeys.add(caseKey(String(row.customer_id), month))
    }
  }

  const emails = Array.from(new Set(
    rows.map((row) => text(row.agent_email).toLowerCase()).filter(Boolean)
  ))
  const validAgents = new Set<string>()
  for (let i = 0; i < emails.length; i += 500) {
    const { data, error } = await supabase
      .from('agents')
      .select('email,role,active')
      .in('email', emails.slice(i, i + 500))

    if (error) throw error

    ;(data ?? [])
      .filter((agent: any) => agent.active && agent.role === 'agent')
      .forEach((agent: any) => validAgents.add(String(agent.email).toLowerCase()))
  }

  const checked: CheckedRow[] = rows.map((row, index) => {
    const messages: string[] = []
    const customerId = text(row.customer_id)
    const caseMonth = normalizeCaseMonth(row.case_month)
    const customerName = text(row.customer_name)
    const lat = numberOrNull(row.given_latitude)
    const lng = numberOrNull(row.given_longitude)
    const agentEmail = text(row.agent_email).toLowerCase()
    const rawEstimatedChurnDate = text(row.estimated_churn_date)
    const estimatedChurnDate = normalizeDate(row.estimated_churn_date)
    const key = customerId && caseMonth ? caseKey(customerId, caseMonth) : ''
    const existing = Boolean(key && existingKeys.has(key))

    if (!customerId) messages.push('Customer ID is required.')
    if (!caseMonth) messages.push('CRL Month is required and must be a valid month/date.')
    if (!customerName) messages.push('Customer name is required.')
    if (key && duplicateKeys.has(key)) messages.push('Duplicate Customer ID + CRL Month inside this file.')
    if (existing) messages.push('This Customer ID + CRL Month already exists and will not be overwritten.')
    if (lat === null || lng === null) messages.push('Latitude and longitude are required.')
    if (lat !== null && (lat < -90 || lat > 90)) messages.push('Latitude must be between -90 and 90.')
    if (lng !== null && (lng < -180 || lng > 180)) messages.push('Longitude must be between -180 and 180.')
    if (agentEmail && !validAgents.has(agentEmail)) messages.push('Assigned agent is not an active agent.')
    if (rawEstimatedChurnDate && !estimatedChurnDate) messages.push('Estimated Churn Date must be YYYY-MM-DD, DD/MM/YYYY, or a valid Excel date.')

    const hasError = messages.length > 0
    const assigned = agentEmail && validAgents.has(agentEmail) ? agentEmail : null

    const payload = hasError ? undefined : {
      customer_id: customerId,
      case_month: caseMonth,
      customer_name: customerName,
      phone_number: nullable(row.phone_number)?.replace(/\D/g, '') || null,
      service_address: nullable(row.service_address),
      product: nullable(row.product),
      outstanding_amount: numberOrNull(row.outstanding_amount) ?? 0,
      payment_status: payment(row.payment_status),
      priority_rank: priority(row.priority_rank),
      days_left_to_churn: numberOrNull(row.days_left_to_churn),
      estimated_churn_date: estimatedChurnDate,
      region: nullable(row.region),
      city: nullable(row.city),
      district: nullable(row.district),
      sub_district: nullable(row.sub_district),
      given_latitude: lat,
      given_longitude: lng,
      speed: numberOrNull(row.speed),
      agent_email: assigned,
      customer_status: assigned ? '1. Assigned' : 'Unassigned',
      assign_status: assigned ? 'assigned' : 'unassigned',
      assignment_date: assigned ? new Date().toISOString().slice(0, 10) : null,
      speed_test: false,
    }

    return {
      row: index + 2,
      customer_id: customerId,
      case_month: caseMonth,
      status: hasError ? 'error' : 'valid',
      messages,
      payload,
      existing,
    }
  })

  const summary = {
    total: checked.length,
    valid: checked.filter((row) => row.status === 'valid').length,
    warnings: checked.filter((row) => row.status === 'warning').length,
    errors: checked.filter((row) => row.status === 'error').length,
    existing: checked.filter((row) => row.existing).length,
  }

  return { rows: checked, summary }
}

export async function POST(request: Request) {
  try {
    const auth = await authorize()
    if ('error' in auth) return auth.error

    const body = await request.json().catch(() => null)
    const action = body?.action === 'import' ? 'import' : 'validate'
    const rows = Array.isArray(body?.rows) ? body.rows : []
    const validation = await validateRows(auth.supabase, rows)

    if (action === 'validate') {
      return NextResponse.json({
        summary: validation.summary,
        rows: validation.rows.map(({ payload, ...row }) => row),
      })
    }

    const valid = validation.rows
      .filter((row) => row.status === 'valid' && row.payload)
      .map((row) => row.payload!)

    let inserted = 0
    for (let i = 0; i < valid.length; i += 250) {
      const chunk = valid.slice(i, i + 250)
      const { error } = await auth.supabase.from('customers').insert(chunk)
      if (error) throw error
      inserted += chunk.length
    }

    return NextResponse.json({
      inserted,
      skipped: validation.summary.total - inserted,
      validation: {
        summary: validation.summary,
        rows: validation.rows.map(({ payload, ...row }) => row),
      },
    })
  } catch (error) {
    console.error('customer import failed', error)
    const message =
      error instanceof Error
        ? error.message
        : (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
          ? String((error as { message: string }).message)
          : 'Unable to process customer import.'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
