alter table public.visits
  drop constraint if exists visits_approved_offer_check;

alter table public.visits
  add constraint visits_approved_offer_check
  check (
    approved_offer is null
    or approved_offer = any (array[
      'Diskon 20% selama 1 bulan + Voucher Rp100.000',
      'Diskon 30% selama 1 bulan + Voucher Rp100.000',
      'Diskon 30% selama 1 bulan + Voucher Rp200.000',
      'Diskon 20% selama 3 bulan + Voucher Rp100.000',
      'Diskon 30% selama 3 bulan + Voucher Rp100.000',
      'Diskon 30% selama 3 bulan + Voucher Rp200.000',
      'Belum ada offer yang disetujui'
    ]::text[])
  );
