create or replace function public.get_superadmin_weekly_report(
  p_start_date date default (date_trunc('month', now() at time zone 'Asia/Jakarta'))::date,
  p_end_date date default (now() at time zone 'Asia/Jakarta')::date,
  p_agent_email text default null
)
returns table (
  agent_email text,
  agent_name text,
  week_start date,
  week_end date,
  pre_visits bigint,
  visits bigint,
  visit_conversion numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'superadmin' then
    raise exception 'Superadmin access required';
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'Invalid report date range';
  end if;

  return query
  with agent_list as (
    select lower(a.email) as email, a.agent_name
    from public.agents a
    where a.active = true
      and a.role = 'agent'
      and (p_agent_email is null or lower(a.email) = lower(p_agent_email))
  ),
  weeks as (
    select gs::date as week_start
    from generate_series(
      date_trunc('week', p_start_date::timestamp)::date,
      date_trunc('week', p_end_date::timestamp)::date,
      interval '1 week'
    ) gs
  ),
  previsit_stats as (
    select
      lower(p.agent_email) as email,
      date_trunc('week', p.created_at at time zone 'Asia/Jakarta')::date as week_start,
      count(*)::bigint as pre_visits
    from public.pre_visits p
    where (p.created_at at time zone 'Asia/Jakarta')::date between p_start_date and p_end_date
    group by lower(p.agent_email), date_trunc('week', p.created_at at time zone 'Asia/Jakarta')::date
  ),
  visit_stats as (
    select
      lower(v.agent_email) as email,
      date_trunc('week', v.visit_date at time zone 'Asia/Jakarta')::date as week_start,
      count(*)::bigint as visits
    from public.visits v
    where (v.visit_date at time zone 'Asia/Jakarta')::date between p_start_date and p_end_date
    group by lower(v.agent_email), date_trunc('week', v.visit_date at time zone 'Asia/Jakarta')::date
  )
  select
    a.email,
    a.agent_name,
    w.week_start,
    least(w.week_start + 6, p_end_date)::date as week_end,
    coalesce(p.pre_visits, 0)::bigint,
    coalesce(v.visits, 0)::bigint,
    case
      when coalesce(p.pre_visits, 0) = 0 then 0::numeric
      else round((coalesce(v.visits, 0)::numeric / p.pre_visits::numeric) * 100, 1)
    end as visit_conversion
  from agent_list a
  cross join weeks w
  left join previsit_stats p on p.email = a.email and p.week_start = w.week_start
  left join visit_stats v on v.email = a.email and v.week_start = w.week_start
  order by w.week_start, a.agent_name nulls last, a.email;
end;
$$;

revoke all on function public.get_superadmin_weekly_report(date,date,text) from public;
grant execute on function public.get_superadmin_weekly_report(date,date,text) to authenticated;
