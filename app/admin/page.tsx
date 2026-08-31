'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getCurrentProfile } from '@/lib/auth'
import type { Agent } from '@/lib/types'
import Loading from '@/components/Loading'

export default function AdminDashboard() {
  const [profile, setProfile] = useState<Agent | null>(null)
  const [counts, setCounts] = useState({ total: 0, assigned: 0, unassigned: 0, visits: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const p = await getCurrentProfile()
        if (p.role !== 'admin') {
          return window.location.replace(p.role === 'superadmin' ? '/superadmin' : '/agent')
        }

        setProfile(p)
        const s = createClient()
        const [{ count: total }, { count: assigned }, { count: unassigned }, { count: visits }] =
          await Promise.all([
            s.from('customers').select('*', { count: 'exact', head: true }),
            s.from('customers').select('*', { count: 'exact', head: true }).not('agent_email', 'is', null),
            s.from('customers').select('*', { count: 'exact', head: true }).is('agent_email', null),
            s.from('visits').select('*', { count: 'exact', head: true }),
          ])

        setCounts({
          total: total || 0,
          assigned: assigned || 0,
          unassigned: unassigned || 0,
          visits: visits || 0,
        })
      } catch (e: any) {
        setError(e.message)
      }
    })()
  }, [])

  if (!profile && !error) {
    return (
      <main className="min-h-screen bg-base-200">
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <Loading text="Loading admin dashboard…" />
        </div>
      </main>
    )
  }

  const initials = profile?.agent_name?.slice(0, 2).toUpperCase() ?? 'AD'

  return (
    <main className="min-h-screen bg-base-200 text-base-content">
      <div className="navbar bg-base-100 shadow-sm border-b border-base-300">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl font-bold tracking-tight">CRL Admin</a>
        </div>

        <div className="flex-none">
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
              <div className="indicator">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="badge badge-sm indicator-item">8</span>
              </div>
            </div>
            <div tabIndex={0} className="card card-sm dropdown-content z-[1] mt-3 w-52 bg-base-100 shadow-lg">
              <div className="card-body">
                <span className="text-lg font-bold">8 Items</span>
                <span className="text-info">Subtotal: $999</span>
                <div className="card-actions">
                  <button className="btn btn-primary btn-block">View cart</button>
                </div>
              </div>
            </div>
          </div>

          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full ring ring-primary/20 ring-offset-base-100 ring-offset-2">
                <div className="flex h-full w-full items-center justify-center bg-primary text-sm font-bold text-primary-content">
                  {initials}
                </div>
              </div>
            </div>
            <ul tabIndex={-1} className="menu menu-sm dropdown-content z-[1] mt-3 w-52 rounded-box bg-base-100 p-2 shadow-lg">
              <li>
                <a className="justify-between">
                  Profile
                  <span className="badge">Admin</span>
                </a>
              </li>
              <li><Link href="/admin/customers">Customers</Link></li>
              <li><Link href="/admin/visits">Visits</Link></li>
              <li><a>Logout</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-4 md:p-8">
        {error && <div className="alert alert-error mb-6 shadow-sm">{error}</div>}

        {profile && (
          <>
            <section className="card mb-6 border border-base-300 bg-base-100 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-14">
                      <span className="text-lg font-bold">{initials}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm tracking-[0.16em] text-base-content/60 uppercase">CRL Admin</p>
                    <h1 className="text-2xl font-bold tracking-tight">{profile.agent_name}</h1>
                    <p className="text-sm text-base-content/70">{profile.email}</p>
                  </div>
                </div>
                <div className="badge badge-success badge-lg gap-2 text-white">
                  <span className="h-2 w-2 rounded-full bg-white"></span>
                  Active
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="text-sm text-base-content/60">Customers</div>
                <div className="mt-4 text-3xl font-black tracking-tight">{counts.total}</div>
              </div>
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="text-sm text-base-content/60">Assigned</div>
                <div className="mt-4 text-3xl font-black tracking-tight">{counts.assigned}</div>
              </div>
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="text-sm text-base-content/60">Unassigned</div>
                <div className="mt-4 text-3xl font-black tracking-tight">{counts.unassigned}</div>
              </div>
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="text-sm text-base-content/60">Visits</div>
                <div className="mt-4 text-3xl font-black tracking-tight">{counts.visits}</div>
              </div>
            </section>

            <section className="card mt-6 bg-base-100 shadow-sm border border-base-300">
              <h2 className="mb-4 text-lg font-bold">Operations</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <Link href="/admin/customers" className="btn btn-primary">Assign Customers</Link>
                <Link href="/admin/visits" className="btn btn-secondary">Monitor Visits</Link>
                <Link href="/admin/pre-visits" className="btn btn-outline">
                  Pre-Visit Monitoring
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
