import Link from 'next/link'
import {
  AlertCircle,
  Eye,
  Inbox,
  UserPlus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import SuperadminPageHeader from '@/components/superadmin/SuperadminPageHeader'
import SuperadminState from '@/components/superadmin/SuperadminState'
import SuperadminPagination from '@/components/superadmin/SuperadminPagination'

const PAGE_SIZE = 10

export default async function ManageCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  const supabase = await createClient()

  const { data: customers, error, count } = await supabase
    .from('customers')
    .select(
      `
      customer_id,
      customer_name,
      phone_number,
      outstanding_amount,
      customer_status,
      agent_email
    `,
      { count: 'exact' }
    )
    .order('customer_name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (error) {
    console.error('superadmin/customers:', error.message)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <SuperadminPageHeader
          breadcrumbs={[
            { label: 'Superadmin', href: '/superadmin' },
            { label: 'Customers' },
          ]}
          title="Customers"
          description="Monitor customer accounts and assignments."
        />
        <SuperadminState
          tone="error"
          icon={AlertCircle}
          title="Unable to load customers"
          description="Please try again."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <SuperadminPageHeader
        breadcrumbs={[
          { label: 'Superadmin', href: '/superadmin' },
          { label: 'Customers' },
        ]}
        title="Customers"
        description="Monitor customer accounts and assignments."
        actions={
          <Link
            href="/superadmin/customers/new"
            className="btn btn-primary btn-sm"
          >
            <UserPlus aria-hidden="true" className="size-4" />
            Add Customer
          </Link>
        }
      />

      {customers.length === 0 ? (
        <SuperadminState
          icon={Inbox}
          title="No customers found"
          description="There are currently no customer records to display."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
            <table className="table table-sm table-zebra">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="hidden md:table-cell">Phone</th>
                  <th className="hidden lg:table-cell">Assigned Agent</th>
                  <th>Outstanding</th>
                  <th className="hidden sm:table-cell">Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.customer_id} className="hover:bg-base-200/50">
                    <td>
                      <Link
                        href={`/superadmin/customers/${encodeURIComponent(
                          customer.customer_id
                        )}`}
                        className="flex flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content"
                      >
                        <span className="font-semibold text-base-content">
                          {customer.customer_name}
                        </span>
                        <span className="text-xs text-base-content/60">
                          {customer.customer_id}
                        </span>
                      </Link>
                    </td>
                    <td className="hidden md:table-cell">
                      {customer.phone_number || '-'}
                    </td>
                    <td className="hidden lg:table-cell">
                      {customer.agent_email || (
                        <span className="text-base-content/50">
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap font-medium tabular-nums">
                      Rp
                      {Number(
                        customer.outstanding_amount ?? 0
                      ).toLocaleString('id-ID')}
                    </td>
                    <td className="hidden sm:table-cell">
                      <span className="badge badge-sm badge-ghost">
                        {customer.customer_status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/superadmin/customers/${encodeURIComponent(
                            customer.customer_id
                          )}`}
                          aria-label={`View ${customer.customer_name}`}
                          title="View customer"
                          className="btn btn-ghost btn-sm btn-square"
                        >
                          <Eye aria-hidden="true" className="size-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SuperadminPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={count ?? 0}
            basePath="/superadmin/customers"
          />
        </>
      )}
    </div>
  )
}
