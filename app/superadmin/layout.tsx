import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import SuperadminShell from '@/components/superadmin/SuperadminShell'

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login')
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('agent_name, email, role, active, circle_id')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()

  if (!agent || !agent.active || agent.role !== 'superadmin') {
    redirect('/auth/route')
  }

  let circleCode: string | null = null
  if (agent.circle_id) {
    const { data: circle } = await supabase.from('circles').select('code').eq('id', agent.circle_id).maybeSingle()
    circleCode = circle?.code ?? null
  }

  return (
    <div>
      <SuperadminShell
        agentName={agent.agent_name ?? 'Superadmin'}
        email={agent.email}
        scopeLabel={circleCode ? `CIRCLE ${circleCode}` : 'NATIONAL'}
        scopePending={Boolean(agent.circle_id)}
      >
        {children}
      </SuperadminShell>
    </div>
  )
}
