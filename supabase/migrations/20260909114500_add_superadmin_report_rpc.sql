create or replace function public.get_superadmin_report(
  p_start_date date default (date_trunc('month', now() at time zone 'Asia/Jakarta'))::date,
  p_end_date date default (now() at time zone 'Asia/Jakarta')::date,
  p_agent_email text default null
)
returns table (
  agent_email text,
  agent_name text,
  assigned_customers bigint,
  paid_customers bigint,
  unpaid_customers bigint,
  p1_customers bigint,
  p2_customers bigint,
  p3_customers bigint,
  p4_customers bigint,
  p5_customers bigint,
  pre_visits bigint,
  ready_for_visit bigint,
  direct_visit bigint,
  visits bigint,
  paid_conversations bigint,
  promise_to_pay bigint,
  attendance_days bigint,
  average_worked_minutes numeric
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
  ), customer_stats as (
    select lower(c.agent_email) as email,
      count(*)::bigint as assigned_customers,
      count(*) filter (where lower(coalesce(c.payment_status, 'unpaid')) = 'paid')::bigint as paid_customers,
      count(*) filter (where lower(coalesce(c.payment_status, 'unpaid')) <> 'paid')::bigint as unpaid_customers,
      count(*) filter (where upper(coalesce(c.priority_rank, '')) = 'P1')::bigint as p1_customers,
      count(*) filter (where upper(coalesce(c.priority_rank, '')) = 'P2')::bigint as p2_customers,
      count(*) filter (where upper(coalesce(c.priority_rank, '')) = 'P3')::bigint as p3_customers,
      count(*) filter (where upper(coalesce(c.priority_rank, '')) = 'P4')::bigint as p4_customers,
      count(*) filter (where upper(coalesce(c.priority_rank, '')) = 'P5')::bigint as p5_customers
    from public.customers c
    where c.agent_email is not null
    group by lower(c.agent_email)
  ), previsit_stats as (
    select lower(p.agent_email) as email,
      count(*)::bigint as pre_visits,
      count(*) filter (where p.previsit_status = 'Ready for Visit')::bigint as ready_for_visit,
      count(*) filter (where p.previsit_status = 'Direct Visit')::bigint as direct_visit
    from public.pre_visits p
    where (p.created_at at time zone 'Asia/Jakarta')::date between p_start_date and p_end_date
    group by lower(p.agent_email)
  ), visit_stats as (
    select lower(v.agent_email) as email,
      count(*)::bigint as visits,
      count(*) filter (where v.conversation_result = 'Sudah melakukan pembayaran')::bigint as paid_conversations,
      count(*) filter (where v.conversation_result = 'Bersedia bayar / Promise to Pay')::bigint as promise_to_pay
    from public.visits v
    where (v.visit_date at time zone 'Asia/Jakarta')::date between p_start_date and p_end_date
    group by lower(v.agent_email)
  ), attendance_stats as (
    select lower(att.agent_email) as email,
      count(*)::bigint as attendance_days,
      round(avg(att.worked_minutes) filter (where att.worked_minutes is not null), 1) as average_worked_minutes
    from public.agent_attendance att
    where att.attendance_date between p_start_date and p_end_date
    group by lower(att.agent_email)
  )
  select
    a.email,
    a.agent_name,
    coalesce(c.assigned_customers, 0),
    coalesce(c.paid_customers, 0),
    coalesce(c.unpaid_customers, 0),
    coalesce(c.p1_customers, 0),
    coalesce(c.p2_customers, 0),
    coalesce(c.p3_customers, 0),
    coalesce(c.p4_customers, 0),
    coalesce(c.p5_customers, 0),
    coalesce(p.pre_visits, 0),
    coalesce(p.ready_for_visit, 0),
    coalesce(p.direct_visit, 0),
    coalesce(v.visits, 0),
    coalesce(v.paid_conversations, 0),
    coalesce(v.promise_to_pay, 0),
    coalesce(att.attendance_days, 0),
    coalesce(att.average_worked_minutes, 0)
  from agent_list a
  left join customer_stats c on c.email = a.email
  left join previsit_stats p on p.email = a.email
  left join visit_stats v on v.email = a.email
  left join attendance_stats att on att.email = a.email
  order by a.agent_name nulls last, a.email;
end;
$$;

revoke all on function public.get_superadmin_report(date,date,text) from public;
grant execute on function public.get_superadmin_report(date,date,text) to authenticated;
