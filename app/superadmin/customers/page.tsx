import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'

export default async function ManageCustomersPage() {
  const supabase = await createClient()

  const { data: customers, error } = await supabase
    .from('customers')
    .select(`
      customer_id,
      customer_name,
      phone_number,
      outstanding_amount,
      customer_status,
      agent_email
    `)
    .order('customer_name')

  if (error) {
    return (
      <main className="mobile-page">
        <p>{error.message}</p>
      </main>
    )
  }

  return (
    <main className="mobile-page">
      <div className="edit-header">
        <Link href="/superadmin" className="back-button">
          ← Back
        </Link>

        <div>
          <p className="eyebrow">SUPERADMIN</p>
          <h1>Manage Customers</h1>
        </div>
      </div>

      <Link
        href="/superadmin/customers/new"
        className="primary-button"
      >
        + Add Customer
      </Link>

      <div className="customer-list">
        {customers?.map((customer) => (
          <Link
            key={customer.customer_id}
            href={`/superadmin/customers/${encodeURIComponent(
              customer.customer_id
            )}`}
            className="customer-row"
          >
            <div>
              <strong>{customer.customer_name}</strong>

              <p>{customer.customer_id}</p>

              <small>
                {customer.agent_email || 'Not assigned'}
              </small>
            </div>

            <div className="customer-right">
              <strong>
                Rp
                {Number(
                  customer.outstanding_amount ?? 0
                ).toLocaleString('id-ID')}
              </strong>

              <small>{customer.customer_status}</small>

              <span>›</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}