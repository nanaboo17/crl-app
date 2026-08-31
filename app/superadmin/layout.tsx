import { Plus_Jakarta_Sans } from 'next/font/google'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import SuperadminShell from '@/components/superadmin/SuperadminShell'

// Jakarta Sans scoped to the Superadmin area only (agent/admin pages keep Inter).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

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
    .select('agent_name, email, role, active')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()

  if (!agent || !agent.active || agent.role !== 'superadmin') {
    redirect('/auth/route')
  }

  return (
    <div
      className={jakarta.variable}
      style={{
        fontFamily:
          'var(--font-jakarta), Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <SuperadminShell
        agentName={agent.agent_name ?? 'Superadmin'}
        email={agent.email}
      >
        {children}
      </SuperadminShell>
    </div>
  )
}
