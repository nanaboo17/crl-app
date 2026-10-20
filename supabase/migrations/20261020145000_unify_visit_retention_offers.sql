-- Retain historical approved offers; accept all six new one-month offers
-- for both 8- and 10-digit billing customer IDs.
ALTER TABLE public.visits
  DROP CONSTRAINT IF EXISTS visits_approved_offer_check;

ALTER TABLE public.visits
  ADD CONSTRAINT visits_approved_offer_check
  CHECK (
    approved_offer IS NULL
    OR approved_offer = ANY (ARRAY[
      -- Existing historical offers, to avoid breaking previous visit records
      'Diskon 20% selama 1 bulan + Voucher Rp100.000',
      'Diskon 30% selama 1 bulan + Voucher Rp100.000',
      'Diskon 30% selama 1 bulan + Voucher Rp200.000',
      'Diskon 20% selama 3 bulan + Voucher Rp100.000',
      'Diskon 30% selama 3 bulan + Voucher Rp100.000',
      'Diskon 30% selama 3 bulan + Voucher Rp200.000',
      -- New offers
      'Diskon 10% selama 1 bulan + Voucher Rp100.000',
      'Diskon 10% selama 1 bulan + Voucher Rp50.000',
      'Diskon 20% selama 1 bulan + Voucher Rp50.000',
      'Diskon 30% selama 1 bulan + Voucher Rp50.000',
      'Belum ada offer yang disetujui'
    ]::text[])
  );
