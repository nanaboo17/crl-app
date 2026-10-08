import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const customerId = typeof body?.customer_id === 'string' ? body.customer_id.trim() : ''

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    }

    const email = user.email.trim().toLowerCase()

    const [{ data: agent, error: agentError }, { data: customer, error: customerError }] = await Promise.all([
      supabase
        .from('agents')
        .select('email, role, active')
        .ilike('email', email)
        .maybeSingle(),
      supabase
        .from('customers')
        .select('customer_id, crl_id, agent_email')
        .eq('customer_id', customerId)
        .ilike('agent_email', email)
        .maybeSingle(),
    ])

    if (agentError) {
      return NextResponse.json({ error: agentError.message }, { status: 400 })
    }

    if (!agent || !agent.active || agent.role !== 'agent') {
      return NextResponse.json({ error: 'Your account is not an active agent.' }, { status: 403 })
    }

    if (customerError) {
      return NextResponse.json({ error: customerError.message }, { status: 400 })
    }

    if (!customer) {
      return NextResponse.json({ error: 'This customer is not assigned to your account.' }, { status: 403 })
    }

    const { error: insertError } = await supabase
      .from('customer_data_unlocks')
      .insert({
        customer_id: customerId,
        crl_id: customer.crl_id,
        agent_email: email,
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('customer data unlock failed', error)
    return NextResponse.json(
      { error: 'Unable to unlock customer data.' },
      { status: 500 }
    )
  }
}
