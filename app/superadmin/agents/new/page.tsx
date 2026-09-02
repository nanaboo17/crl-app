'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'

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
  const { t } = useI18n()
  const router = useRouter()

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

    if (!email.trim()) {
      next.email = t('superadmin.agents.new.emailRequired')
    } else if (!EMAIL_RE.test(email.trim())) {
      next.email = t('superadmin.agents.new.emailInvalid')
    }

    if (!name.trim()) {
      next.agent_name = t('superadmin.agents.new.nameRequired')
    }

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

      const { data: existing, error: lookupError } = await supabase
        .from('agents')
        .select('email')
        .eq('email', cleanEmail)
        .maybeSingle()

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
      setFormError(
        err instanceof Error
          ? err.message
          : t('superadmin.agents.new.saveError'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-dvh bg-base-200 pb-12">
      <div className="dui-navbar bg-base-100 border-b border-base-300">
        <div className="dui-navbar-start">
          <Link
            href="/superadmin/agents"
            className="dui-btn dui-btn-ghost dui-btn-sm"
            aria-label={t('superadmin.agents.new.backAria')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight" translate="no">CRL Field App</div>
            <div className="text-xs text-base-content/60">{t('superadmin.agents.new.subtitle')}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl px-4 sm:px-6 pt-6">
        <div>
          <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-base-content/50">
            {t('superadmin.bc.superadmin')}
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{t('superadmin.agents.new.title')}</h1>
          <p className="mt-1 text-sm text-base-content/60">{t('superadmin.agents.new.description')}</p>
        </div>

        <form className="dui-fieldset dui-card dui-card-border mt-6 bg-base-100 shadow-sm" onSubmit={submit} noValidate>
          <div className="dui-card-body gap-4">
            <div className="dui-fieldset">
              <legend className="dui-fieldset-legend">
                {t('superadmin.agents.new.emailLabel')}
                <span className="text-error">*</span>
              </legend>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t('superadmin.agents.new.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`dui-input w-full ${errors.email ? 'dui-input-error' : ''}`}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="mt-1 text-sm text-error">{errors.email}</p>}
            </div>

            <div className="dui-fieldset">
              <legend className="dui-fieldset-legend">
                {t('superadmin.agents.new.nameLabel')}
                <span className="text-error">*</span>
              </legend>
              <input
                type="text"
                autoComplete="name"
                placeholder={t('superadmin.agents.new.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`dui-input w-full ${errors.agent_name ? 'dui-input-error' : ''}`}
                aria-invalid={!!errors.agent_name}
              />
              {errors.agent_name && <p className="mt-1 text-sm text-error">{errors.agent_name}</p>}
            </div>

            <div className="dui-fieldset">
              <legend className="dui-fieldset-legend">{t('superadmin.agents.new.salesCodeLabel')}</legend>
              <input
                type="text"
                autoComplete="off"
                placeholder={t('superadmin.agents.new.salesCodePlaceholder')}
                value={salesCode}
                onChange={(e) => setSalesCode(e.target.value)}
                className="dui-input w-full"
              />
            </div>

            <div className="dui-fieldset">
              <legend className="dui-fieldset-legend">
                {t('superadmin.agents.new.roleLabel')}
                <span className="text-error">*</span>
              </legend>
              <div className="dui-dropdown">
                <button type="button" tabIndex={0} role="button" className="dui-btn dui-btn-outline w-full justify-between">
                  {t(roleLabelKey(role))}
                  <svg className="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <ul tabIndex={-1} className="dui-dropdown-content dui-menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
                  {ROLES.map((option) => (
                    <li key={option}>
                      <button type="button" className={role === option ? 'dui-menu-active' : ''} onClick={() => setRole(option)}>
                        {t(roleLabelKey(option))}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3">
              <span>
                <strong>{t('superadmin.agents.new.activeLabel')}</strong>
                <span className="block text-sm text-base-content/60">{t('superadmin.agents.new.activeDesc')}</span>
              </span>
              <input type="checkbox" className="dui-toggle dui-toggle-primary" checked={active} onChange={(e) => setActive(e.target.checked)} />
            </label>

            {formError && (
              <div className="dui-alert dui-alert-error" role="alert">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formError}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-2">
              <Link href="/superadmin/agents" className="dui-btn dui-btn-outline">
                {t('superadmin.agents.new.cancel')}
              </Link>
              <button type="submit" className="dui-btn dui-btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <span className="dui-loading dui-loading-spinner dui-loading-sm" />
                    {t('superadmin.agents.new.saving')}
                  </>
                ) : (
                  t('superadmin.agents.new.save')
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  )
}
