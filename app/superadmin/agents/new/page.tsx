'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Mail, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useI18n } from '@/components/providers/i18n-provider'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import styles from './page.module.css'

const ROLES = ['agent', 'admin', 'superadmin'] as const
const REGIONS = ['CJ', 'EJ', 'JABO 1', 'JABO 2', 'WJ'] as const

type Role = (typeof ROLES)[number]
type Region = (typeof REGIONS)[number]

type FormErrors = {
  email?: string
  agent_name?: string
  role?: string
  phone_num?: string
  lead_email?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^(?:0|62)\d{8,13}$/

const REGION_LEAD_MAP: Record<Region, string> = {
  CJ: 'xlckesawa@gmail.com',
  EJ: 'xlckesawa@gmail.com',
  'JABO 1': 'hidjrah.umami@gmail.com',
  'JABO 2': 'hidjrah.umami@gmail.com',
  WJ: 'hidjrah.umami@gmail.com',
}

function roleLabelKey(role: Role): string {
  if (role === 'admin') return 'superadmin.agents.new.roleAdmin'
  if (role === 'superadmin') return 'superadmin.agents.new.roleSuperadmin'
  return 'superadmin.agents.new.roleAgent'
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, '')
}

export default function NewAgentPage() {
  const { locale, t } = useI18n()
  const router = useRouter()
  const tx = (en: string, id: string) => (locale === 'id' ? id : en)

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [phoneNum, setPhoneNum] = useState('')
  const [region, setRegion] = useState<Region | ''>('')
  const [leadEmail, setLeadEmail] = useState('')
  const [role, setRole] = useState<Role>('agent')
  const [active, setActive] = useState(true)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const expectedLeadEmail = useMemo(
    () => (region ? REGION_LEAD_MAP[region] : ''),
    [region]
  )

  function handleRegionChange(value: string) {
    const nextRegion = value as Region | ''
    setRegion(nextRegion)
    setLeadEmail(nextRegion ? REGION_LEAD_MAP[nextRegion] : '')
  }

  function validate(): FormErrors {
    const next: FormErrors = {}
    if (!email.trim()) next.email = t('superadmin.agents.new.emailRequired')
    else if (!EMAIL_RE.test(email.trim())) next.email = t('superadmin.agents.new.emailInvalid')
    if (!name.trim()) next.agent_name = t('superadmin.agents.new.nameRequired')

    const normalizedPhone = normalizePhone(phoneNum)
    if (phoneNum.trim() && !PHONE_RE.test(normalizedPhone)) {
      next.phone_num = tx(
        'Use 10–15 digits starting with 0 or 62.',
        'Gunakan 10–15 digit yang diawali 0 atau 62.'
      )
    }

    if (leadEmail.trim() && !EMAIL_RE.test(leadEmail.trim())) {
      next.lead_email = tx('Enter a valid lead email.', 'Masukkan email lead yang valid.')
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
      const { data: existing, error: lookupError } = await supabase.from('agents').select('email').eq('email', cleanEmail).maybeSingle()
      if (lookupError) throw lookupError
      if (existing) {
        setFormError(t('superadmin.agents.new.emailExists', { email: cleanEmail }))
        return
      }

      const { error } = await supabase.rpc('superadmin_create_agent_v2', {
        p_email: cleanEmail,
        p_agent_name: name.trim(),
        p_organization: organization.trim() || null,
        p_role: role,
        p_active: active,
        p_phone_num: normalizePhone(phoneNum) || null,
        p_region: region || null,
        p_lead_email: leadEmail.trim().toLowerCase() || null,
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
              <label htmlFor="phone-num">{tx('Phone Number', 'Nomor Telepon')}</label>
              <input
                id="phone-num"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="08xxxxxxxxxx / 62xxxxxxxxxxx"
                value={phoneNum}
                onChange={(e) => setPhoneNum(e.target.value)}
                className={`${styles.input} ${errors.phone_num ? styles.inputError : ''}`}
                aria-invalid={!!errors.phone_num}
              />
              {errors.phone_num && <p className={styles.fieldError}>{errors.phone_num}</p>}
            </div>

            <div className={styles.field}>
              <label htmlFor="organization">{tx('Organization', 'Organisasi')}</label>
              <input id="organization" type="text" autoComplete="organization" placeholder={tx('e.g. IOH, Field Agent, vendor', 'contoh: IOH, Field Agent, vendor')} value={organization} onChange={(e) => setOrganization(e.target.value)} className={styles.input} />
            </div>

            <div className={styles.field}>
              <label htmlFor="region">{tx('Region', 'Region')}</label>
              <select id="region" value={region} onChange={(e) => handleRegionChange(e.target.value)} className={styles.select}>
                <option value="">{tx('Select region', 'Pilih region')}</option>
                {REGIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="lead-email">{tx('Lead Email', 'Email Lead')}</label>
              <input
                id="lead-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={expectedLeadEmail || 'lead@example.com'}
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                className={`${styles.input} ${errors.lead_email ? styles.inputError : ''}`}
                aria-invalid={!!errors.lead_email}
              />
              {region && (
                <p className="text-xs text-base-content/55">
                  {tx('Auto-filled from selected region.', 'Terisi otomatis berdasarkan region yang dipilih.')}
                </p>
              )}
              {errors.lead_email && <p className={styles.fieldError}>{errors.lead_email}</p>}
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
