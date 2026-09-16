-- Paid customers remain non-actionable, but keep their historical agent_email.

create or replace function public.sync_customer_payment_statuses(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_count integer := 0;
  v_status text;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_status := lower(trim(v_item->>'payment_status'));
    if v_status not in ('paid', 'unpaid') then
      continue;
    end if;

    update public.customers
    set payment_status = v_status,
        payment_source_actual_bill_dtm = nullif(v_item->>'actual_bill_dtm', '')::timestamptz,
        payment_synced_at = now(),
        customer_status = case when v_status = 'paid' then 'Paid' else customer_status end,
        agent_email = agent_email,
        assignment_date = assignment_date,
        assign_status = case
          when v_status = 'paid' then 'completed'
          when nullif(btrim(agent_email), '') is not null then 'assigned'
          else 'unassigned'
        end
    where customer_id = trim(v_item->>'customer_id');

    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;

create or replace function public.refresh_customer_assignments()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_auto_assigned integer := 0;
  v_rolled_forward integer := 0;
  v_completed integer := 0;
begin
  update public.customers
  set customer_status = 'Paid',
      assign_status = 'completed'
  where lower(coalesce(payment_status,'')) = 'paid'
    and (customer_status is distinct from 'Paid' or assign_status is distinct from 'completed');

  update public.customers
  set assign_status = 'completed'
  where exists (select 1 from public.visits v where v.customer_id = customers.customer_id)
    and assign_status is distinct from 'completed';
  get diagnostics v_completed = row_count;

  update public.customers c
  set assignment_date = coalesce(c.assignment_date, v_today),
      assign_status = 'assigned'
  where lower(coalesce(c.payment_status,'unpaid')) <> 'paid'
    and not exists (select 1 from public.visits v where v.customer_id = c.customer_id)
    and nullif(btrim(c.agent_email),'') is not null
    and (c.assign_status is distinct from 'assigned' or c.assignment_date is null);

  update public.customers c
  set agent_email = t.agent_email,
      assignment_date = v_today,
      assign_status = 'assigned'
  from public.territories t
  where t.territory_code = c.territory
    and lower(coalesce(c.payment_status,'unpaid')) <> 'paid'
    and not exists (select 1 from public.visits v where v.customer_id = c.customer_id)
    and (c.agent_email is null or btrim(c.agent_email) = '')
    and nullif(btrim(t.agent_email),'') is not null
    and coalesce(t.active,true);
  get diagnostics v_auto_assigned = row_count;

  update public.customers c
  set assignment_date = v_today,
      assign_status = 'assigned'
  where lower(coalesce(c.payment_status,'unpaid')) <> 'paid'
    and not exists (select 1 from public.visits v where v.customer_id = c.customer_id)
    and nullif(btrim(c.agent_email),'') is not null
    and c.assignment_date is distinct from v_today;
  get diagnostics v_rolled_forward = row_count;

  update public.customers c
  set assign_status = 'unassigned', assignment_date = null
  where lower(coalesce(c.payment_status,'unpaid')) <> 'paid'
    and not exists (select 1 from public.visits v where v.customer_id = c.customer_id)
    and (c.agent_email is null or btrim(c.agent_email) = '');

  return jsonb_build_object(
    'date', v_today,
    'auto_assigned', v_auto_assigned,
    'rolled_forward', v_rolled_forward,
    'completed', v_completed,
    'duplicates_cleared', 0
  );
end;
$$;

create or replace function public.set_territory_agent_by_code(p_territory_code text, p_agent_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not exists (
    select 1 from public.agents a
    where lower(a.email)=lower(auth.jwt()->>'email')
      and a.active and a.role in ('admin','superadmin')
  ) then raise exception 'Not authorized'; end if;

  if p_territory_code is null or btrim(p_territory_code)='' then
    raise exception 'Territory code is required';
  end if;

  if p_agent_email is not null and btrim(p_agent_email)<>'' then
    select a.email into v_email
    from public.agents a
    where lower(a.email)=lower(btrim(p_agent_email))
      and a.role='agent' and a.active
    limit 1;
    if v_email is null then raise exception 'Active agent not found'; end if;
  else
    v_email := null;
  end if;

  update public.territories
  set agent_email=v_email, updated_at=now()
  where territory_code=btrim(p_territory_code);
  if not found then raise exception 'Territory not found'; end if;

  update public.customers c
  set agent_email = v_email,
      assignment_date = case when v_email is null then null else (now() at time zone 'Asia/Jakarta')::date end,
      assign_status = case when v_email is null then 'unassigned' else 'assigned' end
  where c.territory = btrim(p_territory_code)
    and lower(coalesce(c.payment_status,'unpaid')) <> 'paid'
    and not exists (select 1 from public.visits v where v.customer_id=c.customer_id);
end;
$$;

with candidate as (
  select c.customer_id,
         coalesce(
           (select v.agent_email from public.visits v where v.customer_id=c.customer_id order by v.visit_date desc, v.created_at desc limit 1),
           (select p.agent_email from public.pre_visits p where p.customer_id=c.customer_id order by p.created_at desc, p.previsit_id desc limit 1),
           (select t.agent_email from public.territories t where t.territory_code=c.territory and nullif(btrim(t.agent_email),'') is not null limit 1)
         ) as recovered_agent
  from public.customers c
  where lower(coalesce(c.payment_status,''))='paid'
    and (c.agent_email is null or btrim(c.agent_email)='')
)
update public.customers c
set agent_email = candidate.recovered_agent,
    assign_status = 'completed'
from candidate
where c.customer_id = candidate.customer_id
  and candidate.recovered_agent is not null;

comment on column public.customers.agent_email is 'Historical/current CRL agent owner. Payment becoming paid must not clear this value.';
