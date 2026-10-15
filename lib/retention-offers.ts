export type RetentionOffer = { value: string; label: string }

const vouchers = [100000, 100000, 200000] as const
const discounts = [20, 30, 30] as const

/** Match billing customer IDs, never CRL case IDs. */
export function retentionOffersForCustomer(customerId: string | null | undefined): RetentionOffer[] {
  const id = String(customerId || '').trim()
  const months = /^1000\d{6}$/.test(id) ? 1 : /^1[12]\d{6}$/.test(id) ? 3 : null
  if (!months) return []
  return discounts.map((discount, index) => {
    const voucher = vouchers[index]
    return {
      value: `Diskon ${discount}% selama ${months} bulan + Voucher Rp${voucher.toLocaleString('id-ID')}`,
      label: `${discount}% Discount – ${months} ${months === 1 ? 'Month' : 'Months'} + Rp${voucher.toLocaleString('en-US')} Voucher`,
    }
  })
}

export const NO_APPROVED_OFFER = 'Belum ada offer yang disetujui'
