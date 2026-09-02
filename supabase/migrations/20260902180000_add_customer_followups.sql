create table if not exists public.customer_followups (
  followup_id uuid primary key default gen_random_uuid(),
  customer_id text not null references public.customers(customer_id) on update cascade on delete cascade,
  agent_email text not null references public.agents(email) on update cascade,
  due_at timestamptz not null,
  note text not null,
  status text not null default 'pending' check (status in ('pending','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists customer_followups_agent_due_idx on public.customer_followups(agent_email, status, due_at);
create index if not exists customer_followups_customer_idx on public.customer_followups(customer_id, created_at desc);

alter table public.customer_followups enable row level security;

create policy "agents manage own followups; admins read all"
on public.customer_followups for select to authenticated
using (lower(agent_email) = lower(public.current_email()) or public.current_role() = any (array['admin'::text, 'superadmin'::text]));

create policy "agents create own followups"
on public.customer_followups for insert to authenticated
with check (lower(agent_email) = lower(public.current_email()) or public.current_role() = any (array['admin'::text, 'superadmin'::text]));

create policy "agents update own followups; admins update all"
on public.customer_followups for update to authenticated
using (lower(agent_email) = lower(public.current_email()) or public.current_role() = any (array['admin'::text, 'superadmin'::text]))
with check (lower(agent_email) = lower(public.current_email()) or public.current_role() = any (array['admin'::text, 'superadmin'::text]));

create policy "agents delete own followups; admins delete all"
on public.customer_followups for delete to authenticated
using (lower(agent_email) = lower(public.current_email()) or public.current_role() = any (array['admin'::text, 'superadmin'::text]));
