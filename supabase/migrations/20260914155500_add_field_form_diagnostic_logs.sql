create table if not exists public.field_form_diagnostic_logs (
  log_id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  agent_email text not null default public.current_email(),
  customer_id text,
  form_type text not null check (form_type in ('previsit','visit','unknown')),
  stage text not null,
  severity text not null default 'error' check (severity in ('info','warning','error')),
  request_method text,
  request_target text,
  http_status integer,
  error_code text,
  error_message text,
  error_details text,
  error_hint text,
  page_path text,
  online boolean,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_field_form_diagnostic_logs_created_at on public.field_form_diagnostic_logs(created_at desc);
create index if not exists idx_field_form_diagnostic_logs_agent on public.field_form_diagnostic_logs(lower(agent_email), created_at desc);
create index if not exists idx_field_form_diagnostic_logs_customer on public.field_form_diagnostic_logs(customer_id, created_at desc);
create index if not exists idx_field_form_diagnostic_logs_form on public.field_form_diagnostic_logs(form_type, created_at desc);

alter table public.field_form_diagnostic_logs enable row level security;

drop policy if exists field_form_diagnostic_logs_insert_own on public.field_form_diagnostic_logs;
create policy field_form_diagnostic_logs_insert_own
on public.field_form_diagnostic_logs
for insert
to authenticated
with check (
  lower(agent_email) = lower(public.current_email())
  or public.current_role() in ('admin','superadmin')
);

drop policy if exists field_form_diagnostic_logs_select_admin on public.field_form_diagnostic_logs;
create policy field_form_diagnostic_logs_select_admin
on public.field_form_diagnostic_logs
for select
to authenticated
using (public.current_role() in ('admin','superadmin'));

revoke update, delete on public.field_form_diagnostic_logs from authenticated;
