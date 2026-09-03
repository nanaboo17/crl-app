'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Building2, MapPinned, Plus, RefreshCw, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import styles from './TerritoryManager.module.css'

type Agent = { email: string; agent_name: string; sales_code: string | null }
type Territory = { territory_id: string; territory_code: string; territory_name: string; description: string | null; agent_email: string | null; active: boolean }
type Site = { site_id: string; territory_id: string; site_code: string; site_name: string }
type Homepass = { customer_id: string; territory_id: string; site_id: string | null }
type Customer = { customer_id: string; customer_name: string; service_address: string | null; city: string | null; district: string | null; sub_district: string | null; ae_name: string | null; agent_email: string | null }

export default function TerritoryManager() {
  const supabase = createClient()
  const [agents, setAgents] = useState<Agent[]>([])
  const [territories, setTerritories] = useState<Territory[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [homepasses, setHomepasses] = useState<Homepass[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [territoryForm, setTerritoryForm] = useState({ code: '', name: '', description: '' })
  const [siteForm, setSiteForm] = useState({ territoryId: '', code: '', name: '' })
  const [homepassForm, setHomepassForm] = useState({ territoryId: '', siteId: '', customerId: '' })

  async function load() {
    setLoading(true)
    setError('')
    const [a, t, s, h, c] = await Promise.all([
      supabase.from('agents').select('email,agent_name,sales_code').eq('role', 'agent').eq('active', true).order('agent_name'),
      supabase.from('territories').select('*').order('territory_code'),
      supabase.from('territory_sites').select('*').order('site_code'),
      supabase.from('territory_homepasses').select('customer_id,territory_id,site_id'),
      supabase.from('customers').select('customer_id,customer_name,service_address,city,district,sub_district,ae_name,agent_email').order('customer_name'),
    ])
    const firstError = a.error || t.error || s.error || h.error || c.error
    if (firstError) setError(firstError.message)
    setAgents((a.data || []) as Agent[])
    setTerritories((t.data || []) as Territory[])
    setSites((s.data || []) as Site[])
    setHomepasses((h.data || []) as Homepass[])
    setCustomers((c.data || []) as Customer[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const mappedCustomerIds = useMemo(() => new Set(homepasses.map((h) => h.customer_id)), [homepasses])
  const siteOptions = sites.filter((site) => site.territory_id === homepassForm.territoryId)

  async function createTerritory(e: FormEvent) {
    e.preventDefault()
    if (!territoryForm.code.trim() || !territoryForm.name.trim()) return
    setSaving(true); setError('')
    const { error } = await supabase.from('territories').insert({ territory_code: territoryForm.code.trim(), territory_name: territoryForm.name.trim(), description: territoryForm.description.trim() || null })
    if (error) setError(error.message)
    else { setTerritoryForm({ code: '', name: '', description: '' }); await load() }
    setSaving(false)
  }

  async function createSite(e: FormEvent) {
    e.preventDefault()
    if (!siteForm.territoryId || !siteForm.code.trim() || !siteForm.name.trim()) return
    setSaving(true); setError('')
    const { error } = await supabase.from('territory_sites').insert({ territory_id: siteForm.territoryId, site_code: siteForm.code.trim(), site_name: siteForm.name.trim() })
    if (error) setError(error.message)
    else { setSiteForm({ territoryId: siteForm.territoryId, code: '', name: '' }); await load() }
    setSaving(false)
  }

  async function assignAgent(territoryId: string, email: string) {
    setSaving(true); setError('')
    const { error } = await supabase.rpc('set_territory_agent', { p_territory_id: territoryId, p_agent_email: email || null })
    if (error) setError(error.message); else await load()
    setSaving(false)
  }

  async function assignHomepass(e: FormEvent) {
    e.preventDefault()
    if (!homepassForm.territoryId || !homepassForm.customerId) return
    setSaving(true); setError('')
    const { error } = await supabase.rpc('set_homepass_territory', { p_customer_id: homepassForm.customerId, p_territory_id: homepassForm.territoryId, p_site_id: homepassForm.siteId || null })
    if (error) setError(error.message)
    else { setHomepassForm({ territoryId: homepassForm.territoryId, siteId: homepassForm.siteId, customerId: '' }); await load() }
    setSaving(false)
  }

  async function removeHomepass(customerId: string) {
    setSaving(true); setError('')
    const { error } = await supabase.from('territory_homepasses').delete().eq('customer_id', customerId)
    if (error) setError(error.message); else await load()
    setSaving(false)
  }

  if (loading) return <div className={styles.loading} />

  return (
    <div className={styles.manager}>
      {error && <div className={styles.alert}>{error}</div>}

      <div className={styles.formGrid}>
        <form onSubmit={createTerritory} className={styles.formCard}>
          <div className={styles.formHead}><span className={styles.formHeadIcon}><MapPinned className="h-5 w-5" /></span>Create Territory</div>
          <label className={styles.field}><span className={styles.label}>Territory code</span><input className={styles.input} placeholder="T01" value={territoryForm.code} onChange={(e) => setTerritoryForm({ ...territoryForm, code: e.target.value })} /></label>
          <label className={styles.field}><span className={styles.label}>Territory name</span><input className={styles.input} value={territoryForm.name} onChange={(e) => setTerritoryForm({ ...territoryForm, name: e.target.value })} /></label>
          <label className={styles.field}><span className={styles.label}>Description</span><textarea className={styles.textarea} placeholder="Optional" value={territoryForm.description} onChange={(e) => setTerritoryForm({ ...territoryForm, description: e.target.value })} /></label>
          <button disabled={saving} className={styles.primaryButton}><Plus className="h-4 w-4" />Add Territory</button>
        </form>

        <form onSubmit={createSite} className={styles.formCard}>
          <div className={styles.formHead}><span className={styles.formHeadIcon}><Building2 className="h-5 w-5" /></span>Add Site</div>
          <label className={styles.field}><span className={styles.label}>Territory</span><select className={styles.select} value={siteForm.territoryId} onChange={(e) => setSiteForm({ ...siteForm, territoryId: e.target.value })}><option value="">Select territory</option>{territories.map((t) => <option key={t.territory_id} value={t.territory_id}>{t.territory_code} · {t.territory_name}</option>)}</select></label>
          <label className={styles.field}><span className={styles.label}>Site code</span><input className={styles.input} value={siteForm.code} onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value })} /></label>
          <label className={styles.field}><span className={styles.label}>Site name</span><input className={styles.input} value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} /></label>
          <button disabled={saving} className={styles.secondaryButton}><Plus className="h-4 w-4" />Add Site</button>
        </form>

        <form onSubmit={assignHomepass} className={styles.formCard}>
          <div className={styles.formHead}><span className={styles.formHeadIcon}><Building2 className="h-5 w-5" /></span>Map Homepass</div>
          <label className={styles.field}><span className={styles.label}>Territory</span><select className={styles.select} value={homepassForm.territoryId} onChange={(e) => setHomepassForm({ territoryId: e.target.value, siteId: '', customerId: '' })}><option value="">Select territory</option>{territories.map((t) => <option key={t.territory_id} value={t.territory_id}>{t.territory_code} · {t.territory_name}</option>)}</select></label>
          <label className={styles.field}><span className={styles.label}>Site</span><select className={styles.select} value={homepassForm.siteId} onChange={(e) => setHomepassForm({ ...homepassForm, siteId: e.target.value })}><option value="">No site / territory level</option>{siteOptions.map((s) => <option key={s.site_id} value={s.site_id}>{s.site_code} · {s.site_name}</option>)}</select></label>
          <label className={styles.field}><span className={styles.label}>Customer</span><select className={styles.select} value={homepassForm.customerId} onChange={(e) => setHomepassForm({ ...homepassForm, customerId: e.target.value })}><option value="">Select homepass/customer</option>{customers.filter((c) => !mappedCustomerIds.has(c.customer_id)).map((c) => <option key={c.customer_id} value={c.customer_id}>{c.customer_id} · {c.customer_name}</option>)}</select></label>
          <button disabled={saving} className={styles.accentButton}><Plus className="h-4 w-4" />Assign Homepass</button>
        </form>
      </div>

      <div className={styles.listHead}>
        <div><h2>Territories</h2><p>Assign one field agent to a territory; mapped homepasses inherit that agent and AE name.</p></div>
        <button type="button" onClick={() => void load()} className={styles.refreshButton}><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      <div className={styles.territoryGrid}>
        {territories.map((territory) => {
          const territorySites = sites.filter((s) => s.territory_id === territory.territory_id)
          const territoryHomepasses = homepasses.filter((h) => h.territory_id === territory.territory_id)
          const assignedAgent = agents.find((a) => a.email.toLowerCase() === territory.agent_email?.toLowerCase())
          return (
            <section key={territory.territory_id} className={styles.territoryCard}>
              <div className={styles.cardTop}>
                <div><span className={styles.codeBadge}>{territory.territory_code}</span><h3 className={styles.territoryName}>{territory.territory_name}</h3><p className={styles.description}>{territory.description || 'No description'}</p></div>
                <div className={styles.metrics}><strong>{territorySites.length}</strong> sites · <strong>{territoryHomepasses.length}</strong> homepasses</div>
              </div>

              <label className={styles.field}><span className={styles.label}><UserRound className="inline h-4 w-4" /> Assigned agent</span><select className={styles.select} disabled={saving} value={territory.agent_email || ''} onChange={(e) => void assignAgent(territory.territory_id, e.target.value)}><option value="">Unassigned</option>{agents.map((a) => <option key={a.email} value={a.email}>{a.agent_name} · {a.sales_code || a.email}</option>)}</select></label>
              {assignedAgent && <p className={styles.agentNote}>AE name synced as <strong>{assignedAgent.agent_name}</strong> for every homepass in this territory.</p>}

              <div><h4 className={styles.sectionTitle}>Sites</h4><div className={styles.siteList}>{territorySites.length ? territorySites.map((s) => <span key={s.site_id} className={styles.siteBadge}>{s.site_code} · {s.site_name}</span>) : <span className={styles.emptyText}>No sites yet.</span>}</div></div>

              <div><h4 className={styles.sectionTitle}>Homepasses</h4><div className={styles.homepassList}>{territoryHomepasses.length ? territoryHomepasses.map((h) => {
                const c = customers.find((row) => row.customer_id === h.customer_id)
                const s = sites.find((row) => row.site_id === h.site_id)
                return <div key={h.customer_id} className={styles.homepassRow}><div className={styles.homepassMain}><strong>{c?.customer_name || h.customer_id}</strong><span>{h.customer_id}{s ? ` · ${s.site_code}` : ''} · {c?.sub_district || c?.district || c?.city || '-'}</span></div><button type="button" className={styles.removeButton} disabled={saving} onClick={() => void removeHomepass(h.customer_id)}>Remove</button></div>
              }) : <div className={styles.emptyText} style={{ padding: '1rem' }}>No homepasses mapped.</div>}</div></div>
            </section>
          )
        })}
      </div>
    </div>
  )
}