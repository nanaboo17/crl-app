import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { rolePath, type AppRole } from '@/lib/role'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_oauth_code`)
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) {
    return NextResponse.redirect(`${origin}/login?error=missing_authenticated_user`)
  }

  const normalizedEmail = user.email.trim().toLowerCase()
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('role, active, organization')
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (agentError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(agentError.message)}`
    )
  }

  if (!agent) {
    await supabase.auth.signOut()
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(`Account ${normalizedEmail} is not registered as a CRL user.`)}`
    )
  }

  if (!agent.active) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=account_inactive`)
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  const ipAddress =
    request.headers.get('cf-connecting-ip') ||
    (forwardedFor ? forwardedFor.split(',')[0]?.trim() : null)

  const { error: loginHistoryError } = await supabase
    .from('account_login_history')
    .insert({
      user_id: user.id,
      email: normalizedEmail,
      role: agent.role,
      organization: agent.organization,
      provider: typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : 'google',
      ip_address: ipAddress,
      user_agent: request.headers.get('user-agent'),
    })

  if (loginHistoryError) {
    console.warn('Failed to record account login history:', loginHistoryError.message)
  }

  return NextResponse.redirect(`${origin}${next || rolePath(agent.role as AppRole)}`)
}
