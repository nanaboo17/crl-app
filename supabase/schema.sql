-- CRL Field App v1 schema
-- Run this in a NEW Supabase project using SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.agents (
  email text primary key,
  agent_name text not null,
  sales_code text,
  role text not null default 'agent' check (role in ('agent','admin','superadmin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  customer_id text primary key,
  customer_name text not null,
  phone_number text,
  service_address text,
  product text,
  outstanding_amount numeric(14,2) not null default 0,
  unpaid_since date,
  customer_status text not null default 'Unassigned',
  agent_email text references public.agents(email) on update cascade,
  created_at timestamptz not null default now()
);

create sequence if not exists public.previsit_number_seq start 1;
create sequence if not exists public.visit_number_seq start 1;

create or replace function public.next_previsit_id()
returns text language sql volatile as $$
  select 'PRE' || lpad(nextval('public.previsit_number_seq')::text, 5, '0');
$$;

create or replace function public.next_visit_id()
returns text language sql volatile as $$
  select 'VIS' || lpad(nextval('public.visit_number_seq')::text, 5, '0');
$$;

create table if not exists public.pre_visits (
  previsit_id text primary key default public.next_previsit_id(),
  customer_id text not null unique references public.customers(customer_id) on delete cascade,
  agent_email text not null references public.agents(email) on update cascade,
  contact_attempt_date timestamptz not null default now(),
  contact_confirmed boolean not null default false,
  address_confirmed boolean not null default false,
  confirmed_address text,
  landmark text,
  appointment_confirmed boolean not null default false,
  appointment_date timestamptz,
  contact_result text,
  supervisor_approval boolean not null default false,
  previsit_notes text,
  previsit_status text not null default 'Pending' check (previsit_status in ('Pending','Ready for Visit','Need Follow-up','Supervisor Review','Cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.visits (
  visit_id text primary key default public.next_visit_id(),
  customer_id text not null unique references public.customers(customer_id) on delete cascade,
  agent_email text not null references public.agents(email) on update cascade,
  sales_code text,
  visit_date timestamptz not null default now(),
  customer_phone text,
  updated_phone text,
  visit_address text,
  latitude double precision not null,
  longitude double precision not null,
  gps_accuracy double precision,
  gps_captured_at timestamptz not null,
  visit_photo_url text not null,
  consent_given boolean not null default false check (consent_given = true),
  visit_result text not null,
  visit_summary text,
  created_at timestamptz not null default now()
);

-- Helper functions. SECURITY DEFINER lets policies read role information safely
-- without recursively invoking the Agents RLS policy.
create or replace function public.current_email()
returns text language sql stable as $$ select auth.jwt() ->> 'email'; $$;

create or replace function public.current_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.agents
  where lower(email) = lower(auth.jwt() ->> 'email') and active = true
  limit 1;
$$;

create or replace function public.is_registered_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.agents
    where lower(email) = lower(auth.jwt() ->> 'email') and active = true
  );
$$;

-- Keep customer lifecycle synchronized automatically.
create or replace function public.sync_customer_after_previsit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.customers
  set customer_status = case
    when new.previsit_status = 'Ready for Visit' then '3. Ready for Visit'
    else '2. Pre-Visit'
  end
  where customer_id = new.customer_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_customer_after_previsit on public.pre_visits;
create trigger trg_sync_customer_after_previsit
after insert or update of previsit_status on public.pre_visits
for each row execute function public.sync_customer_after_previsit();

create or replace function public.sync_customer_after_visit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.customers set customer_status = '5. Visited'
  where customer_id = new.customer_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_customer_after_visit on public.visits;
create trigger trg_sync_customer_after_visit
after insert on public.visits
for each row execute function public.sync_customer_after_visit();

alter table public.agents enable row level security;
alter table public.customers enable row level security;
alter table public.pre_visits enable row level security;
alter table public.visits enable row level security;

-- AGENTS: ordinary agents only receive their own profile; admin/superadmin receive all.
drop policy if exists "registered users read own profile; admins read all" on public.agents;
create policy "registered users read own profile; admins read all"
on public.agents for select to authenticated
using (
  lower(email) = lower(public.current_email())
  or public.current_role() in ('admin','superadmin')
);

drop policy if exists "superadmin manages agents" on public.agents;
create policy "superadmin manages agents"
on public.agents for all to authenticated
using (public.current_role() = 'superadmin')
with check (public.current_role() = 'superadmin');

-- CUSTOMERS: agent receives only their assigned rows. Admin/Superadmin receive all.
drop policy if exists "agents read assigned customers; admins read all" on public.customers;
create policy "agents read assigned customers; admins read all"
on public.customers for select to authenticated
using (
  public.current_role() in ('admin','superadmin')
  or lower(agent_email) = lower(public.current_email())
);

drop policy if exists "admins update customers" on public.customers;
create policy "admins update customers"
on public.customers for update to authenticated
using (public.current_role() in ('admin','superadmin'))
with check (public.current_role() in ('admin','superadmin'));

drop policy if exists "superadmin creates customers" on public.customers;
create policy "superadmin creates customers"
on public.customers for insert to authenticated
with check (public.current_role() = 'superadmin');

drop policy if exists "superadmin deletes customers" on public.customers;
create policy "superadmin deletes customers"
on public.customers for delete to authenticated
using (public.current_role() = 'superadmin');

-- PRE-VISITS: one per customer. Agent can only create/update for their assigned customer.
drop policy if exists "agents access own pre-visits; admins access all" on public.pre_visits;
create policy "agents access own pre-visits; admins access all"
on public.pre_visits for select to authenticated
using (
  public.current_role() in ('admin','superadmin')
  or lower(agent_email) = lower(public.current_email())
);

drop policy if exists "agents create own pre-visits" on public.pre_visits;
create policy "agents create own pre-visits"
on public.pre_visits for insert to authenticated
with check (
  public.current_role() in ('admin','superadmin')
  or (
    lower(agent_email) = lower(public.current_email())
    and exists (
      select 1 from public.customers c
      where c.customer_id = pre_visits.customer_id
      and lower(c.agent_email) = lower(public.current_email())
    )
  )
);

drop policy if exists "agents update own pre-visits" on public.pre_visits;
create policy "agents update own pre-visits"
on public.pre_visits for update to authenticated
using (
  public.current_role() in ('admin','superadmin')
  or lower(agent_email) = lower(public.current_email())
)
with check (
  public.current_role() in ('admin','superadmin')
  or lower(agent_email) = lower(public.current_email())
);

drop policy if exists "superadmin deletes pre-visits" on public.pre_visits;
create policy "superadmin deletes pre-visits"
on public.pre_visits for delete to authenticated
using (public.current_role() = 'superadmin');

-- VISITS: one per customer. Agent can only submit their own assigned customer after Ready for Visit.
drop policy if exists "agents access own visits; admins access all" on public.visits;
create policy "agents access own visits; admins access all"
on public.visits for select to authenticated
using (
  public.current_role() in ('admin','superadmin')
  or lower(agent_email) = lower(public.current_email())
);

drop policy if exists "agents create own visits" on public.visits;
create policy "agents create own visits"
on public.visits for insert to authenticated
with check (
  public.current_role() in ('admin','superadmin')
  or (
    lower(agent_email) = lower(public.current_email())
    and exists (
      select 1 from public.customers c
      where c.customer_id = visits.customer_id
      and lower(c.agent_email) = lower(public.current_email())
    )
    and exists (
      select 1 from public.pre_visits p
      where p.customer_id = visits.customer_id
      and p.previsit_status = 'Ready for Visit'
    )
  )
);

drop policy if exists "agents update own visits" on public.visits;
create policy "agents update own visits"
on public.visits for update to authenticated
using (
  public.current_role() in ('admin','superadmin')
  or lower(agent_email) = lower(public.current_email())
)
with check (
  public.current_role() in ('admin','superadmin')
  or lower(agent_email) = lower(public.current_email())
);

drop policy if exists "superadmin deletes visits" on public.visits;
create policy "superadmin deletes visits"
on public.visits for delete to authenticated
using (public.current_role() = 'superadmin');

-- Private visit evidence bucket.
insert into storage.buckets (id, name, public)
values ('visit-evidence','visit-evidence',false)
on conflict (id) do update set public = false;

drop policy if exists "agents upload own visit evidence" on storage.objects;
create policy "agents upload own visit evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'visit-evidence'
  and public.is_registered_user()
  and (
    public.current_role() in ('admin','superadmin')
    or lower((storage.foldername(name))[1]) = lower(public.current_email())
  )
);

drop policy if exists "authorized users read visit evidence" on storage.objects;
create policy "authorized users read visit evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'visit-evidence'
  and (
    public.current_role() in ('admin','superadmin')
    or lower((storage.foldername(name))[1]) = lower(public.current_email())
  )
);

drop policy if exists "superadmin deletes visit evidence" on storage.objects;
create policy "superadmin deletes visit evidence"
on storage.objects for delete to authenticated
using (bucket_id = 'visit-evidence' and public.current_role() = 'superadmin');

-- Optional seed examples. Replace with real emails after Google Auth is configured.
-- insert into public.agents(email,agent_name,sales_code,role) values
-- ('you@gmail.com','Davina','SL12112','superadmin');
