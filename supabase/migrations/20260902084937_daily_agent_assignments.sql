alter table public.customers
  add column if not exists assignment_date date;

alter table public.customers
  alter column assignment_date set default current_date;

update public.customers
set assignment_date = current_date
where agent_email is not null
  and assignment_date is null;

create or replace function public.set_customer_assignment_date()
returns trigger
language plpgsql
as $$
begin
  if new.agent_email is distinct from old.agent_email then
    new.assignment_date := case
      when new.agent_email is null then null
      else current_date
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_set_assignment_date on public.customers;
create trigger customers_set_assignment_date
before update of agent_email on public.customers
for each row
execute function public.set_customer_assignment_date();

drop policy if exists "agents read assigned customers; admins read all" on public.customers;
drop policy if exists "agents read today's assigned customers; admins read all" on public.customers;

create policy "agents read today's assigned customers; admins read all"
on public.customers
for select
to authenticated
using (
  (public.current_role() = any (array['admin'::text, 'superadmin'::text]))
  or (
    lower(agent_email) = lower(public.current_email())
    and assignment_date = current_date
  )
);
