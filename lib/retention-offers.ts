export type RetentionOffer = { value: string; label: string }

/** Eligible billing customer IDs are 8 or 10 digits (not CRL case IDs). */
export function retentionOffersForCustomer(customerId: string | null | undefined): RetentionOffer[] {
  const id = String(customerId || '').trim()
  if (!/^(?:\d{8}|\d{10})$/.test(id)) return []

  const vouchers = [100000, 50000] as const
  const discounts = [10, 20, 30] as const

  return vouchers.flatMap((voucher) =>
    discounts.map((discount) => ({
      value: `Diskon ${discount}% selama 1 bulan + Voucher Rp${voucher.toLocaleString('id-ID')}`,
      label: `${discount}% Discount – 1 Month + Rp${voucher.toLocaleString('en-US')} Voucher`,
    }))
  )
}

export const NO_APPROVED_OFFER = 'Belum ada offer yang disetujui'
