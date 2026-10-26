-- Territory owner changes affect only the current Jakarta case month.
-- Previously assigned historical cases and cases with a recorded visit remain untouched.
create or replace function public.set_territory_agent_by_code(p_territory_code text,p_agent_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
 v_email text;
 v_today date := (now() at time zone 'Asia/Jakarta')::date;
 v_month date := date_trunc('month',now() at time zone 'Asia/Jakarta')::date;
 v_region text;
begin
 if not exists (select 1 from public.agents a where lower(a.email)=lower(auth.jwt()->>'email') and a.active and a.role='superadmin') then
  raise exception 'Not authorized';
 end if;
 if nullif(btrim(p_territory_code),'') is null then raise exception 'Territory code is required'; end if;
 select t.region into v_region from public.territories t where t.territory_code=btrim(p_territory_code) for update;
 if not found then raise exception 'Territory not found'; end if;
 if not public.crl_can_access_region(v_region) then raise exception 'Territory not in your circle'; end if;
 if nullif(btrim(p_agent_email),'') is not null then
  select a.email into v_email from public.agents a
   where lower(a.email)=lower(btrim(p_agent_email)) and a.role='agent' and a.active
   and (public.crl_is_national_superadmin() or public.crl_can_access_region(a.region)) limit 1;
  if v_email is null then raise exception 'Active agent within your circle not found'; end if;
 else v_email := null; end if;
 update public.territories set agent_email=v_email,updated_at=now() where territory_code=btrim(p_territory_code);
 update public.customers c set
  agent_email=v_email,
  assignment_date=case when v_email is null then null else v_today end,
  assign_status=case when v_email is null then 'unassigned' else 'assigned' end
 where c.territory=btrim(p_territory_code)
  and c.case_month=v_month
  and c.speed_test=false
  and lower(coalesce(c.payment_status,'unpaid'))<>'paid'
  and (c.estimated_churn_date is null or c.estimated_churn_date > v_today+1)
  and c.agent_email is distinct from v_email
  and public.crl_can_access_region(c.region)
  and not exists(select 1 from public.visits v where v.crl_id=c.crl_id);
end;
$$;
revoke all on function public.set_territory_agent_by_code(text,text) from public,anon;
grant execute on function public.set_territory_agent_by_code(text,text) to authenticated;

create or replace function public.preview_territory_agent_transfer(p_territory_code text,p_agent_email text)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare v_email text; v_region text; v_count bigint;
begin
 if not exists(select 1 from public.agents a where lower(a.email)=lower(auth.jwt()->>'email') and a.active and a.role='superadmin') then raise exception 'Not authorized'; end if;
 select t.region into v_region from public.territories t where t.territory_code=btrim(p_territory_code);
 if not found then raise exception 'Territory not found'; end if;
 if not public.crl_can_access_region(v_region) then raise exception 'Territory not in your circle'; end if;
 if nullif(btrim(p_agent_email),'') is not null then
  select a.email into v_email from public.agents a where lower(a.email)=lower(btrim(p_agent_email))
  and a.role='agent' and a.active and (public.crl_is_national_superadmin() or public.crl_can_access_region(a.region)) limit 1;
  if v_email is null then raise exception 'Active agent within your circle not found'; end if;
 end if;
 select count(*) into v_count from public.customers c
 where c.territory=btrim(p_territory_code)
  and c.case_month=date_trunc('month',now() at time zone 'Asia/Jakarta')::date
  and c.speed_test=false and lower(coalesce(c.payment_status,'unpaid'))<>'paid'
  and (c.estimated_churn_date is null or c.estimated_churn_date>(now() at time zone 'Asia/Jakarta')::date+1)
  and c.agent_email is distinct from v_email
  and public.crl_can_access_region(c.region)
  and not exists(select 1 from public.visits v where v.crl_id=c.crl_id);
 return v_count;
end;
$$;
revoke all on function public.preview_territory_agent_transfer(text,text) from public,anon;
grant execute on function public.preview_territory_agent_transfer(text,text) to authenticated;