'use client'

import { createClient } from '@/lib/supabase-browser'
import type { Agent } from '@/lib/types'

export async function getCurrentProfile(): Promise<Agent> {
  const supabase = createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) throw new Error('Please sign in first.')

  const { data, error } = await supabase
    .from('agents')
    .select('email,agent_name,sales_code,role,active')
    .eq('email', user.email)
    .eq('active', true)
    .single()

  if (error || !data) throw new Error('Your email is not registered as an active CRL user.')
  return data as Agent
}
