'use client'

import { createClient } from '@/lib/supabase-browser'

export type CmsOption = {
  value: string
  label_en: string
  label_id: string
}

export type CmsFormField = {
  id: number
  form_key: 'pre_visit' | 'visit'
  field_key: string
  label_en: string
  label_id: string
  field_type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'datetime' | 'number'
  required: boolean
  visible: boolean
  sort_order: number
  placeholder_en: string | null
  placeholder_id: string | null
  help_text_en: string | null
  help_text_id: string | null
  options: CmsOption[]
  system_field: boolean
  protected: boolean
}

export async function loadCmsFormFields(formKey: 'pre_visit' | 'visit') {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('form_fields')
    .select('*')
    .eq('form_key', formKey)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as CmsFormField[]
}

export function cmsField(fields: CmsFormField[], key: string) {
  return fields.find((field) => field.field_key === key)
}

export function cmsLabel(field: CmsFormField | undefined, locale: string, fallbackEn: string, fallbackId: string) {
  if (!field) return locale === 'id' ? fallbackId : fallbackEn
  return locale === 'id' ? field.label_id : field.label_en
}

export function cmsPlaceholder(field: CmsFormField | undefined, locale: string, fallback = '') {
  if (!field) return fallback
  return (locale === 'id' ? field.placeholder_id : field.placeholder_en) || fallback
}

export function cmsHelp(field: CmsFormField | undefined, locale: string) {
  if (!field) return ''
  return (locale === 'id' ? field.help_text_id : field.help_text_en) || ''
}

export function cmsOptions(field: CmsFormField | undefined, locale: string) {
  if (!field || !Array.isArray(field.options)) return []
  return field.options.map((option) => ({
    value: String(option.value),
    label: locale === 'id' ? option.label_id : option.label_en,
  }))
}
