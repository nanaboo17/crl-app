import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type InputRow = Record<string, unknown>
type CheckedRow = { row: number; customer_id: string; status: 'valid' | 'warning' | 'error'; messages: string[]; payload?: Record<string, unknown>; existing?: boolean }

const text = (value: unknown) => String(value ?? '').trim()
const nullable = (value: unknown) => { const valueText = text(value); return valueText || null }
const numberOrNull = (value: unknown) => { const valueText = text(value).replace(/,/g, ''); if (!valueText) return null; const number = Number(valueText); return Number.isFinite(number) ? number : null }
const priority = (value: unknown) => { const clean = text(value).toUpperCase(); if (!clean) return null; const match = clean.match(/[1-5]/); return match ? `P${match[0]}` : null }
const payment = (value: unknown) => text(value).toLowerCase() === 'paid' ? 'paid' : 'unpaid'

async function authorize() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: NextResponse.json({ error: 'Please sign in first.' }, { status: 401 }) }
  const { data: profile } = await supabase.from('agents').select('role,active').ilike('email', user.email.trim()).maybeSingle()
  if (!profile?.active || profile.role !== 'superadmin') return { error: NextResponse.json({ error: 'Superadmin access required.' }, { status: 403 }) }
  return { supabase }
}

async function validateRows(supabase: any, rows: InputRow[]) {
  if (!Array.isArray(rows) || rows.length === 0) return { rows: [] as CheckedRow[], summary: { total: 0, valid: 0, warnings: 0, errors: 0, existing: 0 } }
  if (rows.length > 5000) throw new Error('Maximum 5,000 rows per upload.')

  const ids = rows.map((row) => text(row.customer_id)).filter(Boolean)
  const duplicateIds = new Set<string>()
  const seen = new Set<string>()
  ids.forEach((id) => { if (seen.has(id)) duplicateIds.add(id); seen.add(id) })

  const existingIds = new Set<string>()
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = Array.from(new Set(ids.slice(i, i + 500)))
    if (!chunk.length) continue
    const { data, error } = await supabase.from('customers').select('customer_id').in('customer_id', chunk)
    if (error) throw error
    ;(data ?? []).forEach((row: any) => existingIds.add(String(row.customer_id)))
  }

  const emails = Array.from(new Set(rows.map((row) => text(row.agent_email).toLowerCase()).filter(Boolean)))
  const validAgents = new Set<string>()
  for (let i = 0; i < emails.length; i += 500) {
    const { data, error } = await supabase.from('agents').select('email,role,active').in('email', emails.slice(i, i + 500))
    if (error) throw error
    ;(data ?? []).filter((agent: any) => agent.active && agent.role === 'agent').forEach((agent: any) => validAgents.add(String(agent.email).toLowerCase()))
  }

  const checked: CheckedRow[] = rows.map((row, index) => {
    const messages: string[] = []
    const customerId = text(row.customer_id)
    const customerName = text(row.customer_name)
    const lat = numberOrNull(row.given_latitude)
    const lng = numberOrNull(row.given_longitude)
    const agentEmail = text(row.agent_email).toLowerCase()
    const existing = existingIds.has(customerId)

    if (!customerId) messages.push('Customer ID is required.')
    if (!customerName) messages.push('Customer name is required.')
    if (duplicateIds.has(customerId)) messages.push('Duplicate Customer ID inside this file.')
    if (existing) messages.push('Customer ID already exists and will not be overwritten.')
    if (lat === null || lng === null) messages.push('Latitude and longitude are required.')
    if (lat !== null && (lat < -90 || lat > 90)) messages.push('Latitude must be between -90 and 90.')
    if (lng !== null && (lng < -180 || lng > 180)) messages.push('Longitude must be between -180 and 180.')
    if (agentEmail && !validAgents.has(agentEmail)) messages.push('Assigned agent is not an active agent.')

    const hasError = messages.length > 0
    const assigned = agentEmail && validAgents.has(agentEmail) ? agentEmail : null
    const payload = hasError ? undefined : {
      customer_id: customerId,
      customer_name: customerName,
      phone_number: nullable(row.phone_number)?.replace(/\D/g, '') || null,
      service_address: nullable(row.service_address),
      product: nullable(row.product),
      outstanding_amount: numberOrNull(row.outstanding_amount) ?? 0,
      payment_status: payment(row.payment_status),
      priority_rank: priority(row.priority_rank),
      days_left_to_churn: numberOrNull(row.days_left_to_churn),
      estimated_churn_date: nullable(row.estimated_churn_date),
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

    return { row: index + 2, customer_id: customerId, status: hasError ? 'error' : 'valid', messages, payload, existing }
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
      return NextResponse.json({ summary: validation.summary, rows: validation.rows.map(({ payload, ...row }) => row) })
    }

    const valid = validation.rows.filter((row) => row.status === 'valid' && row.payload).map((row) => row.payload!)
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
      validation: { summary: validation.summary, rows: validation.rows.map(({ payload, ...row }) => row) },
    })
  } catch (error) {
    console.error('customer import failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to process customer import.' }, { status: 400 })
  }
}
