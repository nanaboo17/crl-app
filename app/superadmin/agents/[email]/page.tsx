'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function EditAgentPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const email = decodeURIComponent(params.email as string)

  const [name, setName] = useState('')
  const [salesCode, setSalesCode] = useState('')
  const [role, setRole] = useState('agent')
  const [active, setActive] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function loadAgent() {
      const { data } = await supabase
        .from('agents')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (data) {
        setName(data.agent_name)
        setSalesCode(data.sales_code ?? '')
        setRole(data.role)
        setActive(data.active)
      } else {
        // Unknown email (e.g. a stale or mistyped link) — never show an
        // empty edit form that looks editable.
        setNotFound(true)
      }
    }

    loadAgent()
  }, [email])

  async function saveAgent() {
    await supabase
      .from('agents')
      .update({
        agent_name: name,
        sales_code: salesCode,
        role,
        active,
      })
      .eq('email', email)

    router.push('/superadmin/agents')
  }

  if (notFound) {
    return (
      <main className="mobile-page">
        <div className="edit-header">
          <button
            type="button"
            className="back-button"
            onClick={() => router.push('/superadmin/agents')}
          >
            ← Back
          </button>

          <div>
            <p className="eyebrow">SUPERADMIN</p>
            <h1>Agent not found</h1>
          </div>
        </div>

        <div className="card">
          <p className="muted">
            No agent is registered with the email{' '}
            <strong className="truncate">{email}</strong>.
          </p>
        </div>
      </main>
    )
  }

  return (
  <main className="mobile-page">
    <div className="edit-header">
      <button
        type="button"
        className="back-button"
        onClick={() => router.push('/superadmin/agents')}
      >
        ← Back
      </button>

      <div>
        <p className="eyebrow">SUPERADMIN</p>
        <h1>Edit Agent</h1>
      </div>
    </div>

    <div className="status-row">
      <span
        className={
          active
            ? 'status-badge status-active'
            : 'status-badge status-inactive'
        }
      >
        {active ? 'Active' : 'Inactive'}
      </span>
    </div>


      <div className="card form-stack">
        <label>
          Email
          <input value={email} disabled />
        </label>

        <label>
          Agent Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label>
          Sales Code
          <input
            value={salesCode}
            onChange={(e) => setSalesCode(e.target.value)}
          />
        </label>

        <label>
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </label>

        <label className="checkbox-row">
  <input
    type="checkbox"
    checked={active}
    onChange={(e) => setActive(e.target.checked)}
  />
  Active
</label>

        <button
          className="primary-button"
          onClick={saveAgent}
        >
          Save Changes
        </button>
      </div>
    </main>
  )
}