export type AppRole = 'agent' | 'admin' | 'superadmin'

export type Agent = {
  email: string
  agent_name: string
  sales_code: string | null
  role: AppRole
  active: boolean
}

export type Customer = {
  customer_id: string
  customer_name: string
  phone_number: string | null
  service_address: string | null
  product: string | null
  outstanding_amount: number
  unpaid_since: string | null
  customer_status: string
  agent_email: string | null
  created_at?: string
}

export type PreVisit = {
  previsit_id: string
  customer_id: string
  agent_email: string
  contact_attempt_date: string | null
  contact_confirmed: boolean | null
  address_confirmed: boolean | null
  confirmed_address: string | null
  landmark: string | null
  appointment_confirmed: boolean | null
  appointment_date: string | null
  contact_result: string | null
  supervisor_approval: boolean | null
  previsit_notes: string | null
  previsit_status: string
  created_at: string
}

export type Visit = {
  visit_id: string
  customer_id: string
  agent_email: string
  sales_code: string | null
  visit_date: string
  customer_phone: string | null
  updated_phone: string | null
  visit_address: string | null
  latitude: number | null
  longitude: number | null
  gps_accuracy: number | null
  gps_captured_at: string | null
  visit_photo_url: string | null
  consent_given: boolean
  visit_result: string | null
  visit_summary: string | null
  created_at: string
}
