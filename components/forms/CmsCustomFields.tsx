'use client'

import type { CmsFormField } from '@/lib/form-cms'
import { cmsHelp, cmsOptions, cmsPlaceholder } from '@/lib/form-cms'

export default function CmsCustomFields({
  fields,
  values,
  onChange,
  locale,
}: {
  fields: CmsFormField[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  locale: string
}) {
  const visible = fields.filter((field) => !field.system_field && field.visible).sort((a,b) => a.sort_order - b.sort_order)
  if (!visible.length) return null

  return (
    <section className="dui-card border border-base-300 bg-base-100 shadow-sm">
      <div className="dui-card-body gap-4">
        <div>
          <h2 className="font-black">{locale === 'id' ? 'Field Tambahan' : 'Additional Fields'}</h2>
          <p className="mt-1 text-xs text-base-content/60">{locale === 'id' ? 'Field ini dikelola oleh Superadmin melalui CMS.' : 'These fields are managed by Superadmin through the CMS.'}</p>
        </div>
        {visible.map((field) => {
          const label = locale === 'id' ? field.label_id : field.label_en
          const placeholder = cmsPlaceholder(field, locale)
          const help = cmsHelp(field, locale)
          const value = values[field.field_key] ?? ''
          const options = cmsOptions(field, locale)

          return (
            <label key={field.id} className="dui-form-control">
              <span className="mb-1 text-sm font-bold">{label}{field.required ? ' *' : ''}</span>
              {field.field_type === 'textarea' ? (
                <textarea className="dui-textarea dui-textarea-bordered w-full" rows={3} value={String(value)} placeholder={placeholder} onChange={(e) => onChange(field.field_key, e.target.value)} />
              ) : field.field_type === 'select' ? (
                <select className="dui-select dui-select-bordered w-full" value={String(value)} onChange={(e) => onChange(field.field_key, e.target.value)}>
                  <option value="">{placeholder || (locale === 'id' ? 'Pilih…' : 'Select…')}</option>
                  {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : field.field_type === 'radio' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.map((option) => <button key={option.value} type="button" className={`dui-btn ${String(value) === option.value ? 'dui-btn-primary' : 'dui-btn-outline'}`} onClick={() => onChange(field.field_key, option.value)}>{option.label}</button>)}
                </div>
              ) : field.field_type === 'checkbox' ? (
                <input type="checkbox" className="dui-checkbox dui-checkbox-primary" checked={Boolean(value)} onChange={(e) => onChange(field.field_key, e.target.checked)} />
              ) : (
                <input
                  type={field.field_type === 'datetime' ? 'datetime-local' : field.field_type}
                  className="dui-input dui-input-bordered w-full"
                  value={String(value)}
                  placeholder={placeholder}
                  onChange={(e) => onChange(field.field_key, field.field_type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                />
              )}
              {help && <span className="mt-1 text-xs text-base-content/55">{help}</span>}
            </label>
          )
        })}
      </div>
    </section>
  )
}

export function validateCmsCustomFields(fields: CmsFormField[], values: Record<string, unknown>, locale: string) {
  const missing = fields.find((field) => {
    if (field.system_field || !field.visible || !field.required) return false
    const value = values[field.field_key]
    if (field.field_type === 'checkbox') return value !== true
    return value === null || value === undefined || String(value).trim() === ''
  })
  if (!missing) return null
  return locale === 'id'
    ? `${missing.label_id} wajib diisi.`
    : `${missing.label_en} is required.`
}
