'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'

const ROLES = ['agent', 'admin', 'superadmin'] as const
type Role = (typeof ROLES)[number]

function roleLabelKey(role: Role): string {
  if (role === 'admin') return 'superadmin.agents.edit.roleAdmin'
  if (role === 'superadmin') return 'superadmin.agents.edit.roleSuperadmin'
  return 'superadmin.agents.edit.roleAgent'
}

export default function EditAgentPage() {
  const { locale, setLocale, t } = useI18n()
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const email = decodeURIComponent(params.email as string)

  const [name, setName] = useState('')
  const [salesCode, setSalesCode] = useState('')
  const [role, setRole] = useState<Role>('agent')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAgent() {
      const { data } = await supabase
        .from('agents')
        .select('*')
        .eq('email', email)
        .single()

      if (data) {
        setName(data.agent_name)
        setSalesCode(data.sales_code ?? '')
        setRole(data.role)
        setActive(data.active)
      }
    }

    loadAgent()
  }, [email])

  async function saveAgent() {
    setSaving(true)
    setError('')

    const { error: saveError } = await supabase
      .from('agents')
      .update({
        agent_name: name,
        sales_code: salesCode,
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
    <main className="min-h-dvh bg-base-200 pb-12">
      <div className="dui-navbar bg-base-100 border-b border-base-300">
        <div className="dui-navbar-start">
          <Link
            href="/superadmin/agents"
            className="dui-btn dui-btn-ghost dui-btn-sm"
            aria-label={t('superadmin.agents.edit.backAria')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight" translate="no">CRL Field App</div>
            <div className="text-xs text-base-content/60">{t('superadmin.agents.edit.subtitle')}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl px-4 sm:px-6 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-base-content/50">
              {t('superadmin.bc.superadmin')}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{t('superadmin.agents.edit.title')}</h1>
          </div>
          <span className={`dui-badge dui-badge-lg ${active ? 'dui-badge-success dui-badge-soft' : 'dui-badge-error dui-badge-soft'}`}>
            {active ? t('superadmin.status.active') : t('superadmin.status.inactive')}
          </span>
        </div>

        <div className="dui-fieldset dui-card dui-card-border mt-6 bg-base-100 shadow-sm">
          <div className="dui-card-body gap-4">
            <div className="dui-fieldset">
              <legend className="dui-fieldset-legend">{t('superadmin.agents.edit.emailLabel')}</legend>
              <input type="email" value={email} disabled className="dui-input w-full dui-input-ghost" />
            </div>

            <div className="dui-fieldset">
              <legend className="dui-fieldset-legend">{t('superadmin.agents.edit.nameLabel')}</legend>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="dui-input w-full"
              />
            </div>

            <div className="dui-fieldset">
              <legend className="dui-fieldset-legend">{t('superadmin.agents.edit.salesCodeLabel')}</legend>
              <input
                type="text"
                value={salesCode}
                onChange={(e) => setSalesCode(e.target.value)}
                className="dui-input w-full"
              />
            </div>

            <div className="dui-fieldset">
              <legend className="dui-fieldset-legend">{t('superadmin.agents.edit.roleLabel')}</legend>
              <div className="dui-dropdown dui-dropdown-bottom">
                <div
                  tabIndex={0}
                  role="button"
                  className="dui-btn dui-btn-outline w-full justify-between"
                >
                  {t(roleLabelKey(role))}
                  <svg className="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
                <ul
                  tabIndex={-1}
                  className="dui-dropdown-content dui-menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
                >
                  {ROLES.map((option) => (
                    <li key={option}>
                      <button
                        type="button"
                        className={role === option ? 'dui-menu-active' : ''}
                        onClick={() => setRole(option)}
                      >
                        {t(roleLabelKey(option))}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3">
              <span>
                <strong>{t('superadmin.agents.edit.activeLabel')}</strong>
                <span className="block text-sm text-base-content/60">{t('superadmin.agents.edit.activeDesc')}</span>
              </span>
              <input
                type="checkbox"
                className="dui-toggle dui-toggle-primary"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
            </label>

            {error && (
              <div className="dui-alert dui-alert-error" role="alert">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-2">
              <Link href="/superadmin/agents" className="dui-btn dui-btn-outline">
                {t('superadmin.agents.edit.cancel')}
              </Link>
              <button
                type="button"
                className="dui-btn dui-btn-primary"
                onClick={saveAgent}
                disabled={saving}
              >
                {saving ? t('superadmin.agents.edit.saving') : t('superadmin.agents.edit.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
