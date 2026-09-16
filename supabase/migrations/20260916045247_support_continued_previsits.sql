-- Allow a customer to have multiple Pre-Visit records while preserving history.

alter table public.pre_visits
  drop constraint if exists pre_visits_customer_id_key;

drop index if exists public.pre_visits_customer_id_key;

alter table public.pre_visits
  add column if not exists previous_previsit_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pre_visits_previous_previsit_id_fkey'
      and conrelid = 'public.pre_visits'::regclass
  ) then
    alter table public.pre_visits
      add constraint pre_visits_previous_previsit_id_fkey
      foreign key (previous_previsit_id)
      references public.pre_visits(previsit_id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_pre_visits_customer_latest
  on public.pre_visits (customer_id, created_at desc, previsit_id desc);

create or replace function public.sync_customer_after_previsit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_previsit_id text;
begin
  select p.previsit_id
    into latest_previsit_id
  from public.pre_visits p
  where p.customer_id = new.customer_id
  order by p.created_at desc, p.previsit_id desc
  limit 1;

  if latest_previsit_id = new.previsit_id then
    update public.customers
    set customer_status = case
      when new.previsit_status in ('Ready for Visit', 'Direct Visit') then '3. Ready for Visit'
      else '2. Pre-Visit'
    end
    where customer_id = new.customer_id;
  end if;

  return new;
end;
$$;
