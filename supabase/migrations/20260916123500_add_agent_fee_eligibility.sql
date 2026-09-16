alter table public.customers
  add column if not exists agent_fee_eligible boolean not null default false;

comment on column public.customers.agent_fee_eligible is
  'True when payment_status is paid and the customer has at least one visit record. Used to identify cases eligible for agent fee.';

create or replace function public.refresh_agent_fee_eligibility_for_customer(p_customer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers c
  set agent_fee_eligible = (
    lower(coalesce(c.payment_status, '')) = 'paid'
    and exists (
      select 1
      from public.visits v
      where v.customer_id = c.customer_id
    )
  )
  where c.customer_id = p_customer_id;
end;
$$;

revoke all on function public.refresh_agent_fee_eligibility_for_customer(text) from public, anon, authenticated;

create or replace function public.sync_agent_fee_eligibility_on_customer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.agent_fee_eligible := (
    lower(coalesce(new.payment_status, '')) = 'paid'
    and exists (
      select 1 from public.visits v where v.customer_id = new.customer_id
    )
  );
  return new;
end;
$$;

revoke all on function public.sync_agent_fee_eligibility_on_customer() from public, anon, authenticated;

drop trigger if exists trg_sync_agent_fee_eligibility_on_customer on public.customers;
create trigger trg_sync_agent_fee_eligibility_on_customer
before insert or update of payment_status, customer_id
on public.customers
for each row
execute function public.sync_agent_fee_eligibility_on_customer();

create or replace function public.sync_agent_fee_eligibility_on_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_agent_fee_eligibility_for_customer(old.customer_id);
    return old;
  else
    perform public.refresh_agent_fee_eligibility_for_customer(new.customer_id);
    return new;
  end if;
end;
$$;

revoke all on function public.sync_agent_fee_eligibility_on_visit() from public, anon, authenticated;

drop trigger if exists trg_sync_agent_fee_eligibility_on_visit_insert on public.visits;
create trigger trg_sync_agent_fee_eligibility_on_visit_insert
after insert on public.visits
for each row
execute function public.sync_agent_fee_eligibility_on_visit();

drop trigger if exists trg_sync_agent_fee_eligibility_on_visit_delete on public.visits;
create trigger trg_sync_agent_fee_eligibility_on_visit_delete
after delete on public.visits
for each row
execute function public.sync_agent_fee_eligibility_on_visit();

update public.customers c
set agent_fee_eligible = (
  lower(coalesce(c.payment_status, '')) = 'paid'
  and exists (
    select 1 from public.visits v where v.customer_id = c.customer_id
  )
);
