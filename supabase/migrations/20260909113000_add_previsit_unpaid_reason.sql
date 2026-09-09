alter table public.pre_visits
add column if not exists unpaid_reason text;
