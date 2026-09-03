'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Mail, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import styles from './page.module.css'

const ROLES = ['agent', 'admin', 'superadmin'] as const
type Role = (typeof ROLES)[number]

type FormErrors = {
  email?: string
  agent_name?: string
  role?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function roleLabelKey(role: Role): string {
  if (role === 'admin') return 'superadmin.agents.new.roleAdmin'
  if (role === 'superadmin') return 'superadmin.agents.new.roleSuperadmin'
  return 'superadmin.agents.new.roleAgent'
}

export default function NewAgentPage() {
  const { locale, t } = useI18n()
  const router = useRouter()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [salesCode, setSalesCode] = useState('')
  const [role, setRole] = useState<Role>('agent')
  const [active, setActive] = useState(true)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  function validate(): FormErrors {
    const next: FormErrors = {}
    if (!email.trim()) next.email = t('superadmin.agents.new.emailRequired')
    else if (!EMAIL_RE.test(email.trim())) next.email = t('superadmin.agents.new.emailInvalid')
    if (!name.trim()) next.agent_name = t('superadmin.agents.new.nameRequired')
    return next
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    setFormError('')
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      const supabase = createClient()
      const cleanEmail = email.trim().toLowerCase()
      const { data: existing, error: lookupError } = await supabase.from('agents').select('email').eq('email', cleanEmail).maybeSingle()
      if (lookupError) throw lookupError
      if (existing) {
        setFormError(t('superadmin.agents.new.emailExists', { email: cleanEmail }))
        return
      }

      const { error } = await supabase.rpc('superadmin_create_agent', {
        p_email: cleanEmail,
        p_agent_name: name.trim(),
        p_sales_code: salesCode.trim() || null,
        p_role: role,
        p_active: active,
      })
      if (error) throw error
      router.push('/superadmin/agents')
      router.refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('superadmin.agents.new.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <SuperadminPageHeader
        breadcrumbs={[
          { label: t('superadmin.bc.superadmin'), href: '/superadmin' },
          { label: t('superadmin.bc.agents'), href: '/superadmin/agents' },
          { label: t('superadmin.agents.new.title') },
        ]}
        title={t('superadmin.agents.new.title')}
        description={t('superadmin.agents.new.description')}
      />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{tx('TEAM ONBOARDING', 'ONBOARDING TIM')}</span>
          <h2>{tx('Add a new CRL team member.', 'Tambahkan anggota baru ke tim CRL.')}</h2>
          <p>{tx(
            'Create the profile, choose the right access role, and decide whether the account should be active immediately.',
            'Buat profil, pilih peran akses yang tepat, dan tentukan apakah akun langsung aktif.'
          )}</p>
        </div>
        <div className={styles.heroIcon} aria-hidden="true"><UserPlus /></div>
      </section>

      <form className={styles.formCard} onSubmit={submit} noValidate>
        <div className={styles.formHead}>
          <div className={styles.formIcon}><Mail aria-hidden="true" /></div>
          <div>
            <h3>{tx('Account details', 'Detail akun')}</h3>
            <p>{tx('Required fields are marked with *.', 'Kolom wajib ditandai dengan *.')}</p>
          </div>
        </div>

        <div className={styles.formBody}>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="agent-email">{t('superadmin.agents.new.emailLabel')} <span className={styles.required}>*</span></label>
              <input id="agent-email" type="email" inputMode="email" autoComplete="email" placeholder={t('superadmin.agents.new.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} className={`${styles.input} ${errors.email ? styles.inputError : ''}`} aria-invalid={!!errors.email} />
              {errors.email && <p className={styles.fieldError}>{errors.email}</p>}
            </div>

            <div className={styles.field}>
              <label htmlFor="agent-name">{t('superadmin.agents.new.nameLabel')} <span className={styles.required}>*</span></label>
              <input id="agent-name" type="text" autoComplete="name" placeholder={t('superadmin.agents.new.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} className={`${styles.input} ${errors.agent_name ? styles.inputError : ''}`} aria-invalid={!!errors.agent_name} />
              {errors.agent_name && <p className={styles.fieldError}>{errors.agent_name}</p>}
            </div>

            <div className={styles.field}>
              <label htmlFor="sales-code">{t('superadmin.agents.new.salesCodeLabel')}</label>
              <input id="sales-code" type="text" autoComplete="off" placeholder={t('superadmin.agents.new.salesCodePlaceholder')} value={salesCode} onChange={(e) => setSalesCode(e.target.value)} className={styles.input} />
            </div>

            <div className={styles.field}>
              <label htmlFor="agent-role">{t('superadmin.agents.new.roleLabel')} <span className={styles.required}>*</span></label>
              <select id="agent-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={styles.select}>
                {ROLES.map((option) => <option key={option} value={option}>{t(roleLabelKey(option))}</option>)}
              </select>
            </div>
          </div>

          <label className={styles.statusRow}>
            <span>
              <strong>{t('superadmin.agents.new.activeLabel')}</strong>
              <span>{t('superadmin.agents.new.activeDesc')}</span>
            </span>
            <input type="checkbox" className={styles.toggle} checked={active} onChange={(e) => setActive(e.target.checked)} />
          </label>

          {formError && <div className={styles.error} role="alert"><AlertCircle aria-hidden="true" className="size-4" /><span>{formError}</span></div>}

          <div className={styles.actions}>
            <Link href="/superadmin/agents" className={styles.cancel}>{t('superadmin.agents.new.cancel')}</Link>
            <button type="submit" className={styles.save} disabled={saving}>
              {saving && <span className={styles.spinner} aria-hidden="true" />}
              {saving ? t('superadmin.agents.new.saving') : t('superadmin.agents.new.save')}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
