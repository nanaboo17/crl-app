-- Customer, Pre-Visit, and Visit deletion is an authorized Supabase maintenance action.
-- Do not expose DELETE to CRL app roles, including Superadmin.

drop policy if exists "superadmin deletes customers" on public.customers;
drop policy if exists "pre_visits_delete_superadmin" on public.pre_visits;
drop policy if exists "superadmin deletes visits" on public.visits;
