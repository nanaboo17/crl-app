-- Keep legacy status columns as compatibility mirrors, but derive them from source data.

create or replace function public.sync_customer_compat_status_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- visit_status is a compatibility mirror of the visits table.
  if exists (
    select 1 from public.visits v where v.customer_id = new.customer_id
  ) then
    new.visit_status := 'Visited';
  else
    new.visit_status := null;
  end if;

  -- assign_status is a compatibility mirror, not a source of truth.
  new.assign_status := case
    when lower(coalesce(new.payment_status, '')) = 'paid' then 'completed'
    when exists (select 1 from public.visits v where v.customer_id = new.customer_id) then 'completed'
    when nullif(btrim(new.agent_email), '') is not null then 'assigned'
    else 'unassigned'
  end;

  return new;
end;
$$;

revoke execute on function public.sync_customer_compat_status_fields() from public, anon, authenticated;

drop trigger if exists trg_sync_customer_compat_status_fields on public.customers;
create trigger trg_sync_customer_compat_status_fields
before insert or update of agent_email, payment_status, customer_status, visit_status, assign_status
on public.customers
for each row
execute function public.sync_customer_compat_status_fields();

update public.customers c
set visit_status = case
      when exists (select 1 from public.visits v where v.customer_id = c.customer_id) then 'Visited'
      else null
    end,
    assign_status = case
      when lower(coalesce(c.payment_status, '')) = 'paid' then 'completed'
      when exists (select 1 from public.visits v where v.customer_id = c.customer_id) then 'completed'
      when nullif(btrim(c.agent_email), '') is not null then 'assigned'
      else 'unassigned'
    end;

comment on column public.customers.customer_status is 'Authoritative CRL workflow status (for example Unassigned, 1. Assigned, 2. Pre-Visit, 3. Ready for Visit, 5. Visited, Paid).';
comment on column public.customers.assign_status is 'Compatibility mirror derived from agent_email/payment/visit state. Do not use as assignment source of truth.';
comment on column public.customers.visit_status is 'Compatibility mirror derived from existence of a visits row. Do not use as visit source of truth.';
