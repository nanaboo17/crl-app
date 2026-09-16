-- Preserve agent assignments for every unpaid customer account.
-- Household/billing-account de-duplication must not silently clear agent_email.

create or replace function public.refresh_customer_assignments()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_auto_assigned integer := 0;
  v_rolled_forward integer := 0;
  v_completed integer := 0;
begin
  -- Paid accounts are no longer actionable and are intentionally unassigned.
  update public.customers
  set customer_status = 'Paid',
      assign_status = 'completed',
      agent_email = null,
      assignment_date = null
  where lower(coalesce(payment_status,'')) = 'paid'
    and (
      assign_status is distinct from 'completed'
      or agent_email is not null
      or assignment_date is not null
      or customer_status is distinct from 'Paid'
    );

  -- Completed visits stay completed, but retain the historical agent assignment.
  update public.customers
  set assign_status = 'completed'
  where lower(coalesce(visit_status,'')) = 'visited'
    and lower(coalesce(payment_status,'')) <> 'paid'
    and assign_status is distinct from 'completed';
  get diagnostics v_completed = row_count;

  -- Every unpaid, unvisited customer that already has an agent keeps that agent.
  update public.customers
  set assign_status = 'assigned'
  where lower(coalesce(payment_status,'unpaid')) <> 'paid'
    and lower(coalesce(visit_status,'')) <> 'visited'
    and agent_email is not null
    and btrim(agent_email) <> ''
    and assign_status is distinct from 'assigned';

  -- Assign every unpaid, unvisited customer without an agent to its active territory owner.
  -- Do not de-duplicate by household or billing account here.
  update public.customers c
  set agent_email = t.agent_email,
      assignment_date = v_today,
      assign_status = 'assigned'
  from public.territories t
  where t.territory_code = c.territory
    and lower(coalesce(c.payment_status,'unpaid')) <> 'paid'
    and lower(coalesce(c.visit_status,'')) <> 'visited'
    and (c.agent_email is null or btrim(c.agent_email) = '')
    and t.agent_email is not null
    and btrim(t.agent_email) <> ''
    and coalesce(t.active,true);
  get diagnostics v_auto_assigned = row_count;

  -- Keep today's assignment date for active unpaid workloads.
  update public.customers
  set assignment_date = v_today,
      assign_status = 'assigned'
  where lower(coalesce(payment_status,'unpaid')) <> 'paid'
    and lower(coalesce(visit_status,'')) <> 'visited'
    and agent_email is not null
    and btrim(agent_email) <> ''
    and assignment_date is distinct from v_today;
  get diagnostics v_rolled_forward = row_count;

  -- Only customers with no agent and no available territory owner remain unassigned.
  update public.customers
  set assign_status = 'unassigned',
      assignment_date = null
  where lower(coalesce(payment_status,'unpaid')) <> 'paid'
    and lower(coalesce(visit_status,'')) <> 'visited'
    and (agent_email is null or btrim(agent_email) = '')
    and (assign_status is distinct from 'unassigned' or assignment_date is not null);

  return jsonb_build_object(
    'date', v_today,
    'auto_assigned', v_auto_assigned,
    'rolled_forward', v_rolled_forward,
    'completed', v_completed,
    'duplicates_cleared', 0
  );
end;
$function$;

create or replace function public.set_territory_agent_by_code(p_territory_code text, p_agent_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if not exists (
    select 1 from public.agents a
    where lower(a.email) = lower(auth.jwt()->>'email')
      and a.active
      and a.role in ('admin','superadmin')
  ) then
    raise exception 'Not authorized';
  end if;

  if p_territory_code is null or btrim(p_territory_code) = '' then
    raise exception 'Territory code is required';
  end if;

  if p_agent_email is not null and btrim(p_agent_email) <> '' then
    select a.email into v_email
    from public.agents a
    where lower(a.email) = lower(btrim(p_agent_email))
      and a.role = 'agent'
      and a.active
    limit 1;
    if v_email is null then raise exception 'Active agent not found'; end if;
  else
    v_email := null;
  end if;

  update public.territories
  set agent_email = v_email, updated_at = now()
  where territory_code = btrim(p_territory_code);

  if not found then
    raise exception 'Territory not found';
  end if;

  if v_email is null then
    -- Explicit territory unassignment clears only active unpaid/unvisited work.
    update public.customers
    set agent_email = null,
        assignment_date = null,
        assign_status = 'unassigned'
    where territory = btrim(p_territory_code)
      and lower(coalesce(payment_status,'unpaid')) <> 'paid'
      and lower(coalesce(visit_status,'')) <> 'visited';
  else
    -- Assign every unpaid, unvisited billing account in the territory.
    -- No household winner/de-duplication rule is applied.
    update public.customers
    set agent_email = v_email,
        assignment_date = v_today,
        assign_status = 'assigned'
    where territory = btrim(p_territory_code)
      and lower(coalesce(payment_status,'unpaid')) <> 'paid'
      and lower(coalesce(visit_status,'')) <> 'visited';
  end if;
end;
$function$;