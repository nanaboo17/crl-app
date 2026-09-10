import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { rolePath, type AppRole } from '@/lib/role'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

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
    .select('role, active')
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

  return NextResponse.redirect(`${origin}${rolePath(agent.role as AppRole)}`)
}
