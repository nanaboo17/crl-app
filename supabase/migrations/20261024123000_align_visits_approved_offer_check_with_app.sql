-- Allow the current retention offers plus historical offers already used in visit records.
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_approved_offer_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_approved_offer_check CHECK (
  approved_offer IS NULL OR approved_offer IN (
    'Belum ada offer yang disetujui',
    'Diskon 10% selama 1 bulan + Voucher Rp50.000',
    'Diskon 20% selama 1 bulan + Voucher Rp50.000',
    'Diskon 30% selama 1 bulan + Voucher Rp50.000',
    'Diskon 10% selama 1 bulan + Voucher Rp100.000',
    'Diskon 20% selama 1 bulan + Voucher Rp100.000',
    'Diskon 30% selama 1 bulan + Voucher Rp100.000',
    'Diskon 30% selama 1 bulan + Voucher Rp200.000',
    'Diskon 20% selama 3 bulan + Voucher Rp100.000',
    'Diskon 30% selama 3 bulan + Voucher Rp100.000',
    'Diskon 30% selama 3 bulan + Voucher Rp200.000'
  )
);
