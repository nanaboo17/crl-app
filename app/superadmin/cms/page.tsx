'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, LockKeyhole, Plus, Save, Settings2, ShieldCheck, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import { useI18n } from '@/components/providers/i18n-provider'
import type { CmsFormField, CmsOption } from '@/lib/form-cms'

type FormKey = 'pre_visit' | 'visit'

const emptyField = (formKey: FormKey, order: number): Omit<CmsFormField, 'id'> => ({
  form_key: formKey,
  field_key: '',
  label_en: '',
  label_id: '',
  field_type: 'text',
  required: false,
  visible: true,
  sort_order: order,
  placeholder_en: null,
  placeholder_id: null,
  help_text_en: null,
  help_text_id: null,
  options: [],
  system_field: false,
  protected: false,
})

function normalizeFieldKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export default function CmsPage() {
  const { locale } = useI18n()
  const tx = (en: string, id: string) => locale === 'id' ? id : en
  const [formKey, setFormKey] = useState<FormKey>('pre_visit')
  const [fields, setFields] = useState<CmsFormField[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const s = createClient()
    const { data, error } = await s.from('form_fields').select('*').eq('form_key', formKey).order('sort_order').order('id')
    if (error) setError(error.message)
    else setFields((data ?? []) as CmsFormField[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [formKey])

  const customCount = useMemo(() => fields.filter((f) => !f.system_field).length, [fields])

  function patch(id: number, changes: Partial<CmsFormField>) {
    setFields((current) => current.map((field) => field.id === id ? { ...field, ...changes } : field))
  }

  async function saveField(field: CmsFormField) {
    setSavingId(field.id)
    setMessage('')
    setError('')
    const s = createClient()
    const { error } = await s.from('form_fields').update({
      label_en: field.label_en.trim(),
      label_id: field.label_id.trim(),
      field_type: field.field_type,
      required: field.required,
      visible: field.visible,
      sort_order: field.sort_order,
      placeholder_en: field.placeholder_en || null,
      placeholder_id: field.placeholder_id || null,
      help_text_en: field.help_text_en || null,
      help_text_id: field.help_text_id || null,
      options: field.options,
      updated_at: new Date().toISOString(),
    }).eq('id', field.id)

    if (error) setError(error.message)
    else setMessage(tx('Field saved.', 'Field berhasil disimpan.'))
    setSavingId(null)
  }

  async function addField() {
    setError('')
    setMessage('')
    const s = createClient()
    const draft = emptyField(formKey, (fields.at(-1)?.sort_order ?? 0) + 10)
    const keyBase = formKey === 'pre_visit' ? 'custom_previsit' : 'custom_visit'
    const fieldKey = normalizeFieldKey(`${keyBase}_${Date.now()}`)
    const { data, error } = await s.from('form_fields').insert({
      ...draft,
      field_key: fieldKey,
      label_en: 'New custom field',
      label_id: 'Field custom baru',
    }).select('*').single()

    if (error) setError(error.message)
    else {
      setFields((current) => [...current, data as CmsFormField])
      setMessage(tx('Custom field added.', 'Field custom ditambahkan.'))
    }
  }

  async function removeField(field: CmsFormField) {
    if (field.system_field) return
    const s = createClient()
    const { error } = await s.from('form_fields').delete().eq('id', field.id)
    if (error) setError(error.message)
    else setFields((current) => current.filter((item) => item.id !== field.id))
  }

  async function move(field: CmsFormField, direction: -1 | 1) {
    const sorted = [...fields].sort((a,b) => a.sort_order - b.sort_order)
    const index = sorted.findIndex((item) => item.id === field.id)
    const other = sorted[index + direction]
    if (!other) return
    const s = createClient()
    const aOrder = field.sort_order
    const bOrder = other.sort_order
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      s.from('form_fields').update({ sort_order: bOrder, updated_at: new Date().toISOString() }).eq('id', field.id),
      s.from('form_fields').update({ sort_order: aOrder, updated_at: new Date().toISOString() }).eq('id', other.id),
    ])
    if (e1 || e2) setError((e1 || e2)?.message || 'Unable to reorder fields.')
    else await load()
  }


  function patchOption(fieldId: number, optionIndex: number, changes: Partial<CmsOption>) {
    setFields((current) => current.map((field) => {
      if (field.id !== fieldId) return field
      const options = [...(field.options || [])]
      options[optionIndex] = { ...options[optionIndex], ...changes }
      return { ...field, options }
    }))
  }

  function addOption(field: CmsFormField) {
    const nextNumber = (field.options?.length ?? 0) + 1
    const value = field.system_field ? `option_${nextNumber}` : `option_${Date.now()}`
    patch(field.id, {
      options: [...(field.options || []), {
        value,
        label_en: `Option ${nextNumber}`,
        label_id: `Pilihan ${nextNumber}`,
      }],
    })
  }

  function removeOption(field: CmsFormField, optionIndex: number) {
    if (field.system_field) return
    patch(field.id, { options: (field.options || []).filter((_, index) => index !== optionIndex) })
  }

  function moveOption(field: CmsFormField, optionIndex: number, direction: -1 | 1) {
    const target = optionIndex + direction
    if (target < 0 || target >= (field.options?.length ?? 0)) return
    const options = [...field.options]
    ;[options[optionIndex], options[target]] = [options[target], options[optionIndex]]
    patch(field.id, { options })
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 p-4 sm:p-6">
      <SuperadminPageHeader
        breadcrumbs={[{ label: 'Superadmin', href: '/superadmin' }, { label: 'CMS', icon: Settings2 }]}
        title="Content Management System"
        description={tx('Configure the Agent Pre-Visit and Visit forms without changing code.', 'Atur form Pra-Kunjungan dan Kunjungan Agent tanpa mengubah kode.')}
      />

      <div className="grid gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:grid-cols-2">
        <button onClick={() => setFormKey('pre_visit')} className={`dui-btn h-auto min-h-16 justify-start px-4 py-3 ${formKey === 'pre_visit' ? 'dui-btn-primary' : 'dui-btn-outline'}`}>
          <div className="text-left"><div className="font-black">{tx('Pre-Visit Form', 'Form Pra-Kunjungan')}</div><div className="text-xs opacity-75">{tx('Questions shown before field visit.', 'Pertanyaan sebelum kunjungan lapangan.')}</div></div>
        </button>
        <button onClick={() => setFormKey('visit')} className={`dui-btn h-auto min-h-16 justify-start px-4 py-3 ${formKey === 'visit' ? 'dui-btn-primary' : 'dui-btn-outline'}`}>
          <div className="text-left"><div className="font-black">{tx('Visit Form', 'Form Kunjungan')}</div><div className="text-xs opacity-75">{tx('Questions completed during/after visit.', 'Pertanyaan saat/setelah kunjungan.')}</div></div>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">{formKey === 'pre_visit' ? tx('Pre-Visit fields', 'Field Pra-Kunjungan') : tx('Visit fields', 'Field Kunjungan')}</h2>
          <p className="text-sm text-base-content/60">{fields.length} {tx('fields', 'field')} · {customCount} custom</p>
        </div>
        <button onClick={addField} className="dui-btn dui-btn-primary"><Plus className="size-4" />{tx('Add Custom Field', 'Tambah Field Custom')}</button>
      </div>

      {message && <div className="dui-alert dui-alert-success"><span>{message}</span></div>}
      {error && <div className="dui-alert dui-alert-error"><span>{error}</span></div>}

      {loading ? <div className="py-16 text-center"><span className="dui-loading dui-loading-spinner dui-loading-lg" /></div> : (
        <div className="grid gap-3">
          {fields.map((field, index) => (
            <section key={field.id} className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black">{field.label_id || field.label_en}</h3>
                    <span className={`dui-badge dui-badge-sm ${field.system_field ? 'dui-badge-secondary' : 'dui-badge-accent'}`}>{field.system_field ? 'SYSTEM' : 'CUSTOM'}</span>
                    {field.protected && <span className="dui-badge dui-badge-sm dui-badge-warning"><ShieldCheck className="size-3" />Protected</span>}
                    {!field.visible && <span className="dui-badge dui-badge-sm"><EyeOff className="size-3" />Hidden</span>}
                  </div>
                  <div className="mt-1 font-mono text-xs text-base-content/50">{field.field_key}</div>
                </div>
                <div className="flex gap-1">
                  <button type="button" className="dui-btn dui-btn-sm dui-btn-ghost" onClick={() => move(field, -1)} disabled={index === 0}><ArrowUp className="size-4" /></button>
                  <button type="button" className="dui-btn dui-btn-sm dui-btn-ghost" onClick={() => move(field, 1)} disabled={index === fields.length - 1}><ArrowDown className="size-4" /></button>
                  {!field.system_field && <button type="button" className="dui-btn dui-btn-sm dui-btn-ghost text-error" onClick={() => removeField(field)}><Trash2 className="size-4" /></button>}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="dui-form-control"><span className="dui-label-text mb-1 text-xs font-bold">Label (ID)</span><input className="dui-input dui-input-bordered w-full" value={field.label_id} onChange={(e) => patch(field.id, { label_id: e.target.value })} /></label>
                <label className="dui-form-control"><span className="dui-label-text mb-1 text-xs font-bold">Label (EN)</span><input className="dui-input dui-input-bordered w-full" value={field.label_en} onChange={(e) => patch(field.id, { label_en: e.target.value })} /></label>
                <label className="dui-form-control"><span className="dui-label-text mb-1 text-xs font-bold">{tx('Field type', 'Tipe field')}</span><select className="dui-select dui-select-bordered w-full" value={field.field_type} onChange={(e) => patch(field.id, { field_type: e.target.value as CmsFormField['field_type'] })} disabled={field.system_field}>{['text','textarea','select','radio','checkbox','date','datetime','number'].map((type) => <option key={type}>{type}</option>)}</select></label>
                <label className="dui-form-control"><span className="dui-label-text mb-1 text-xs font-bold">{tx('Order', 'Urutan')}</span><input type="number" className="dui-input dui-input-bordered w-full" value={field.sort_order} onChange={(e) => patch(field.id, { sort_order: Number(e.target.value) })} /></label>
                <label className="dui-form-control"><span className="dui-label-text mb-1 text-xs font-bold">Placeholder (ID)</span><input className="dui-input dui-input-bordered w-full" value={field.placeholder_id || ''} onChange={(e) => patch(field.id, { placeholder_id: e.target.value })} /></label>
                <label className="dui-form-control"><span className="dui-label-text mb-1 text-xs font-bold">Placeholder (EN)</span><input className="dui-input dui-input-bordered w-full" value={field.placeholder_en || ''} onChange={(e) => patch(field.id, { placeholder_en: e.target.value })} /></label>
                <label className="dui-form-control md:col-span-2"><span className="dui-label-text mb-1 text-xs font-bold">{tx('Help text (ID)', 'Teks bantuan (ID)')}</span><input className="dui-input dui-input-bordered w-full" value={field.help_text_id || ''} onChange={(e) => patch(field.id, { help_text_id: e.target.value })} /></label>
                <label className="dui-form-control md:col-span-2"><span className="dui-label-text mb-1 text-xs font-bold">{tx('Help text (EN)', 'Teks bantuan (EN)')}</span><input className="dui-input dui-input-bordered w-full" value={field.help_text_en || ''} onChange={(e) => patch(field.id, { help_text_en: e.target.value })} /></label>
              </div>

              {(field.field_type === 'select' || field.field_type === 'radio') && (
                <div className="mt-4 rounded-2xl border border-base-300 bg-base-200/35 p-3 sm:p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black">{tx('Answer options', 'Pilihan jawaban')}</div>
                      <p className="mt-1 text-xs text-base-content/55">
                        {field.system_field
                          ? tx('Edit what agents see. Internal values stay locked to keep workflow logic safe.', 'Ubah teks yang dilihat agent. Nilai internal dikunci agar logika workflow tetap aman.')
                          : tx('Add, remove, rename, or reorder the choices shown in the form.', 'Tambah, hapus, ubah nama, atau atur urutan pilihan yang tampil di form.')}
                      </p>
                    </div>
                    {!field.system_field && (
                      <button type="button" className="dui-btn dui-btn-outline dui-btn-sm" onClick={() => addOption(field)}>
                        <Plus className="size-4" />
                        {tx('Add option', 'Tambah pilihan')}
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3">
                    {(field.options || []).map((option, optionIndex) => (
                      <div key={`${field.id}-${optionIndex}`} className="rounded-xl border border-base-300 bg-base-100 p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <GripVertical className="size-4 shrink-0 text-base-content/35" aria-hidden="true" />
                            <span className="text-xs font-black uppercase tracking-wide text-base-content/60">
                              {tx('Option', 'Pilihan')} {optionIndex + 1}
                            </span>
                            {field.system_field && (
                              <span className="dui-badge dui-badge-ghost dui-badge-sm gap-1">
                                <LockKeyhole className="size-3" />
                                {tx('Value locked', 'Value dikunci')}
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" className="dui-btn dui-btn-ghost dui-btn-xs" onClick={() => moveOption(field, optionIndex, -1)} disabled={optionIndex === 0} aria-label={tx('Move option up', 'Pindahkan pilihan ke atas')}>
                              <ChevronUp className="size-4" />
                            </button>
                            <button type="button" className="dui-btn dui-btn-ghost dui-btn-xs" onClick={() => moveOption(field, optionIndex, 1)} disabled={optionIndex === field.options.length - 1} aria-label={tx('Move option down', 'Pindahkan pilihan ke bawah')}>
                              <ChevronDown className="size-4" />
                            </button>
                            {!field.system_field && (
                              <button type="button" className="dui-btn dui-btn-ghost dui-btn-xs text-error" onClick={() => removeOption(field, optionIndex)} aria-label={tx('Delete option', 'Hapus pilihan')}>
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-[minmax(0,.7fr)_minmax(0,1fr)_minmax(0,1fr)]">
                          <label className="dui-form-control">
                            <span className="mb-1 text-[11px] font-bold uppercase tracking-wide text-base-content/55">{tx('Internal value', 'Nilai internal')}</span>
                            <div className="relative">
                              {field.system_field && <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/35" />}
                              <input
                                className={`dui-input dui-input-bordered w-full ${field.system_field ? 'pl-9 font-mono text-sm opacity-70' : ''}`}
                                value={option.value}
                                disabled={field.system_field}
                                onChange={(e) => patchOption(field.id, optionIndex, { value: e.target.value })}
                              />
                            </div>
                          </label>
                          <label className="dui-form-control">
                            <span className="mb-1 text-[11px] font-bold uppercase tracking-wide text-base-content/55">Label (ID)</span>
                            <input className="dui-input dui-input-bordered w-full" value={option.label_id} onChange={(e) => patchOption(field.id, optionIndex, { label_id: e.target.value })} />
                          </label>
                          <label className="dui-form-control">
                            <span className="mb-1 text-[11px] font-bold uppercase tracking-wide text-base-content/55">Label (EN)</span>
                            <input className="dui-input dui-input-bordered w-full" value={option.label_en} onChange={(e) => patchOption(field.id, optionIndex, { label_en: e.target.value })} />
                          </label>
                        </div>
                      </div>
                    ))}

                    {(field.options || []).length === 0 && (
                      <div className="rounded-xl border border-dashed border-base-300 bg-base-100 px-4 py-6 text-center">
                        <p className="text-sm font-bold">{tx('No options yet', 'Belum ada pilihan')}</p>
                        <p className="mt-1 text-xs text-base-content/55">{tx('Add the first option for this field.', 'Tambahkan pilihan pertama untuk field ini.')}</p>
                        {!field.system_field && (
                          <button type="button" className="dui-btn dui-btn-primary dui-btn-sm mt-3" onClick={() => addOption(field)}>
                            <Plus className="size-4" />{tx('Add option', 'Tambah pilihan')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" className="dui-toggle dui-toggle-primary dui-toggle-sm" checked={field.visible} disabled={field.protected} onChange={(e) => patch(field.id, { visible: e.target.checked })} />{field.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}{tx('Visible', 'Tampil')}</label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" className="dui-toggle dui-toggle-primary dui-toggle-sm" checked={field.required} disabled={field.protected} onChange={(e) => patch(field.id, { required: e.target.checked })} />{tx('Required', 'Wajib')}</label>
                </div>
                <button type="button" className="dui-btn dui-btn-primary w-full sm:w-auto" onClick={() => saveField(field)} disabled={savingId === field.id}><Save className="size-4" />{savingId === field.id ? tx('Saving…', 'Menyimpan…') : tx('Save field', 'Simpan field')}</button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
