'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, Save, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import styles from './page.module.css'

const ROLES = ['agent', 'admin', 'superadmin'] as const
type Role = (typeof ROLES)[number]

function roleLabelKey(role: Role): string {
  if (role === 'admin') return 'superadmin.agents.edit.roleAdmin'
  if (role === 'superadmin') return 'superadmin.agents.edit.roleSuperadmin'
  return 'superadmin.agents.edit.roleAgent'
}

export default function EditAgentPage() {
  const { locale, t } = useI18n()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const email = decodeURIComponent(params.email as string)

  const [name, setName] = useState('')
  const [salesCode, setSalesCode] = useState('')
  const [role, setRole] = useState<Role>('agent')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadAgent() {
      setLoading(true)
      setError('')
      const { data, error: loadError } = await supabase
        .from('agents')
        .select('agent_name,sales_code,role,active')
        .eq('email', email)
        .single()

      if (cancelled) return
      if (loadError || !data) {
        setError(loadError?.message || tx('Unable to load this account.', 'Akun ini tidak dapat dimuat.'))
        setLoading(false)
        return
      }

      setName(data.agent_name || '')
      setSalesCode(data.sales_code ?? '')
      setRole(data.role)
      setActive(data.active)
      setLoading(false)
    }

    void loadAgent()
    return () => { cancelled = true }
  }, [email])

  async function saveAgent() {
    if (!name.trim()) {
      setError(tx('Agent name is required.', 'Nama agen wajib diisi.'))
      return
    }

    setSaving(true)
    setError('')

    const { error: saveError } = await supabase
      .from('agents')
      .update({
        agent_name: name.trim(),
        sales_code: salesCode.trim() || null,
        role,
        active,
      })
      .eq('email', email)

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    router.push('/superadmin/agents')
    router.refresh()
  }

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: t('superadmin.bc.superadmin'), href: '/superadmin' },
          { label: t('superadmin.bc.agents'), href: '/superadmin/agents' },
          { label: name || email },
        ]}
        title={t('superadmin.agents.edit.title')}
        description={tx('Update account ownership, access level, and field identity.', 'Perbarui identitas akun, tingkat akses, dan status pengguna lapangan.')}
      />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{tx('TEAM PROFILE', 'PROFIL TIM')}</span>
          <h2>{loading ? tx('Loading account…', 'Memuat akun…') : name || '—'}</h2>
          <p>{email}</p>
        </div>
        <span className={`${styles.heroBadge} ${active ? styles.heroBadgeActive : styles.heroBadgeInactive}`}>
          <span aria-hidden="true">●</span>
          {active ? t('superadmin.status.active') : t('superadmin.status.inactive')}
        </span>
      </section>

      <section className={styles.formCard}>
        <div className={styles.formHead}>
          <div className={styles.formIcon}><UserRound aria-hidden="true" className="h-5 w-5" /></div>
          <div>
            <h3>{tx('Account details', 'Detail akun')}</h3>
            <p>{tx('Changes are applied to this CRL user account.', 'Perubahan akan diterapkan ke akun pengguna CRL ini.')}</p>
          </div>
        </div>

        <div className={styles.formBody}>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="agent-email">{t('superadmin.agents.edit.emailLabel')}</label>
              <input id="agent-email" type="email" value={email} disabled className={styles.input} />
            </div>

            <div className={styles.field}>
              <label htmlFor="agent-name">{t('superadmin.agents.edit.nameLabel')}</label>
              <input id="agent-name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={loading || saving} className={styles.input} />
            </div>

            <div className={styles.field}>
              <label htmlFor="sales-code">{t('superadmin.agents.edit.salesCodeLabel')}</label>
              <input id="sales-code" type="text" value={salesCode} onChange={(e) => setSalesCode(e.target.value)} disabled={loading || saving} className={styles.input} />
            </div>

            <div className={styles.field}>
              <label htmlFor="agent-role">{t('superadmin.agents.edit.roleLabel')}</label>
              <select id="agent-role" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={loading || saving} className={styles.select}>
                {ROLES.map((option) => <option key={option} value={option}>{t(roleLabelKey(option))}</option>)}
              </select>
            </div>
          </div>

          <label className={styles.statusRow}>
            <span>
              <strong>{t('superadmin.agents.edit.activeLabel')}</strong>
              <span>{t('superadmin.agents.edit.activeDesc')}</span>
            </span>
            <input type="checkbox" className={styles.toggle} checked={active} disabled={loading || saving} onChange={(e) => setActive(e.target.checked)} />
          </label>

          {error && <div className={styles.error} role="alert"><AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{error}</span></div>}

          <div className={styles.actions}>
            <Link href="/superadmin/agents" className={styles.cancel}>{t('superadmin.agents.edit.cancel')}</Link>
            <button type="button" className={styles.save} onClick={saveAgent} disabled={saving || loading}>
              <Save aria-hidden="true" className="h-4 w-4" />
              {saving ? t('superadmin.agents.edit.saving') : t('superadmin.agents.edit.save')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
