-- Optimize scoped reporting by checking eligible Circle customers and regions as sets.
-- Preserve National / Circle security restrictions.
CREATE OR REPLACE FUNCTION public.get_superadmin_agent_productivity(p_start_date date, p_end_date date, p_agent_email text DEFAULT NULL::text, p_daily_visit_target numeric DEFAULT NULL::numeric)
 RETURNS TABLE(agent_email text, agent_name text, assigned_leads bigint, attendance_days bigint, no_activity_attendance_days bigint, pre_visit_days bigint, field_visit_days bigint, pre_visit_customer_days bigint, total_visits bigint, visits_per_attendance_day numeric, visits_per_field_day numeric, target_attainment numeric, met bigint, ptp bigint, missing_checkout_days bigint, long_gap_days bigint, first_pre_visit timestamp with time zone, first_visit timestamp with time zone, review text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT public.crl_tracking_role('superadmin') THEN RAISE EXCEPTION 'Superadmin required'; END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date OR p_end_date - p_start_date > 366 THEN
  RAISE EXCEPTION 'Invalid date range (maximum 366 days)'; END IF;
 RETURN QUERY
 WITH staff AS (
  SELECT lower(trim(a.email)) AS email, a.agent_name AS name FROM public.agents a
  WHERE a.role='agent' AND a.active IS TRUE AND (p_agent_email IS NULL OR lower(trim(a.email))=lower(trim(p_agent_email)))
       AND ((SELECT public.crl_is_national_superadmin()) OR upper(btrim(a.region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin'))
 ), assignments AS (
  SELECT lower(trim(c.agent_email)) AS email, count(*)::bigint n
  FROM public.customers c
       WHERE c.agent_email IS NOT NULL
         AND ((SELECT public.crl_is_national_superadmin()) OR upper(btrim(c.region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin'))
       GROUP BY 1
 ), a AS (
  SELECT lower(trim(t.agent_email)) email,t.attendance_date AS day,t.check_in_at,t.check_out_at
  FROM public.agent_attendance t
       WHERE (
         public.crl_is_national_superadmin()
         OR EXISTS (
           SELECT 1 FROM public.agents scope_agent
           WHERE lower(scope_agent.email) =
                 lower(t.agent_email)
             AND scope_agent.role = 'agent'
             AND public.crl_can_access_region(
               scope_agent.region
             )
         )
       )
       AND t.attendance_date BETWEEN p_start_date AND p_end_date AND t.check_in_at IS NOT NULL
 ), pv AS (
  SELECT lower(trim(v.agent_email)) email, (v.contact_attempt_date AT TIME ZONE 'Asia/Jakarta')::date AS day,
   v.contact_attempt_date AS event_time, coalesce(nullif(v.crl_id,''),v.customer_id::text) AS customer_key
  FROM public.pre_visits v
  WHERE ((SELECT public.crl_is_national_superadmin()) OR v.crl_id IN (SELECT crl_id FROM public.customers WHERE upper(btrim(region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin')))
       AND v.contact_attempt_date >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta') AND v.contact_attempt_date < ((p_end_date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
 ), vv AS (
  SELECT lower(trim(v.agent_email)) email, (v.visit_date AT TIME ZONE 'Asia/Jakarta')::date AS day,
   v.visit_date AS event_time, v.visit_status_kunjungan, v.conversation_result
  FROM public.visits v
       WHERE ((SELECT public.crl_is_national_superadmin()) OR v.crl_id IN (SELECT crl_id FROM public.customers WHERE upper(btrim(region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin')))
       AND v.visit_date >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta') AND v.visit_date < ((p_end_date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
 ), events AS (
  SELECT email,day,event_time FROM pv UNION ALL SELECT email,day,event_time FROM vv
 ), activity_days AS (
  SELECT DISTINCT email,day FROM events
 ), a_stats AS (
  SELECT a.email, count(DISTINCT a.day)::bigint att_days,
   count(DISTINCT a.day) FILTER (WHERE NOT EXISTS(SELECT 1 FROM activity_days d WHERE d.email=a.email AND d.day=a.day))::bigint no_act,
   count(DISTINCT a.day) FILTER (WHERE a.check_out_at IS NULL AND a.day < (now() AT TIME ZONE 'Asia/Jakarta')::date)::bigint missed
  FROM a GROUP BY a.email
 ), p_stats AS (
  SELECT email,count(DISTINCT day)::bigint pv_days,count(DISTINCT (customer_key,day))::bigint customer_days,min(event_time) first_pv
  FROM pv GROUP BY email
 ), v_stats AS (
  SELECT email,count(DISTINCT day)::bigint v_days,count(*)::bigint total,
   count(*) FILTER (WHERE visit_status_kunjungan='Bertemu dengan pelanggan')::bigint met_count,
   count(*) FILTER (WHERE conversation_result='Bersedia bayar / Promise to Pay')::bigint ptp_count,
   min(event_time) first_v FROM vv GROUP BY email
 ), ordered_activity AS (
  SELECT a.email,a.day,a.check_in_at AS event_time FROM a
  UNION ALL SELECT email,day,event_time FROM events
 ), gaps AS (
  SELECT email,count(DISTINCT day)::bigint gap_days FROM (
   SELECT email,day,event_time,
    event_time-lag(event_time) OVER (PARTITION BY email,day ORDER BY event_time) gap
   FROM ordered_activity
  ) x WHERE gap > interval '3 hours' GROUP BY email
 )
 SELECT st.email,st.name,coalesce(asg.n,0),
 coalesce(ast.att_days,0),coalesce(ast.no_act,0),coalesce(ps.pv_days,0),
 coalesce(vs.v_days,0),coalesce(ps.customer_days,0),coalesce(vs.total,0),
 CASE WHEN coalesce(ast.att_days,0)>0 THEN round(coalesce(vs.total,0)::numeric/ast.att_days,2) END,
 CASE WHEN coalesce(vs.v_days,0)>0 THEN round(vs.total::numeric/vs.v_days,2) END,
 CASE WHEN p_daily_visit_target>0 AND coalesce(ast.att_days,0)>0 THEN
   round(coalesce(vs.total,0)::numeric/(ast.att_days*p_daily_visit_target)*100,1) END,
 coalesce(vs.met_count,0),coalesce(vs.ptp_count,0),coalesce(ast.missed,0),coalesce(g.gap_days,0),
 ps.first_pv,vs.first_v,
 CASE WHEN coalesce(ast.missed,0)>0 OR coalesce(ast.no_act,0)>0 OR coalesce(g.gap_days,0)>0 THEN 'Review' ELSE 'OK' END
 FROM staff st LEFT JOIN assignments asg ON asg.email=st.email
 LEFT JOIN a_stats ast ON ast.email=st.email LEFT JOIN p_stats ps ON ps.email=st.email
 LEFT JOIN v_stats vs ON vs.email=st.email LEFT JOIN gaps g ON g.email=st.email
 ORDER BY st.name NULLS LAST,st.email;
END $function$
;

CREATE OR REPLACE FUNCTION public.get_superadmin_report(p_start_date date DEFAULT (date_trunc('month'::text, (now() AT TIME ZONE 'Asia/Jakarta'::text)))::date, p_end_date date DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta'::text))::date, p_agent_email text DEFAULT NULL::text)
 RETURNS TABLE(agent_email text, agent_name text, assigned_customers bigint, paid_customers bigint, unpaid_customers bigint, p1_customers bigint, p2_customers bigint, p3_customers bigint, p4_customers bigint, p5_customers bigint, pre_visits bigint, ready_for_visit bigint, direct_visit bigint, visits bigint, paid_conversations bigint, promise_to_pay bigint, attendance_days bigint, average_worked_minutes numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       and ((SELECT public.crl_is_national_superadmin()) OR upper(btrim(a.region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin'))
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
       and ((SELECT public.crl_is_national_superadmin()) OR upper(btrim(c.region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin'))
    group by lower(c.agent_email)
  ), previsit_latest as (
    select distinct on (lower(p.agent_email), p.crl_id)
      lower(p.agent_email) as email,
      p.crl_id,
      p.previsit_status
    from public.pre_visits p
    where p.crl_id is not null
       and ((SELECT public.crl_is_national_superadmin()) OR p.crl_id IN (SELECT crl_id FROM public.customers WHERE upper(btrim(region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin')))
      and p.created_at >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta') AND p.created_at < ((p_end_date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    order by lower(p.agent_email), p.crl_id, p.created_at desc, p.previsit_id desc
  ), previsit_stats as (
    select pl.email,
      count(*)::bigint as pre_visits,
      count(*) filter (where pl.previsit_status = 'Ready for Visit')::bigint as ready_for_visit,
      count(*) filter (where pl.previsit_status = 'Direct Visit')::bigint as direct_visit
    from previsit_latest pl
    group by pl.email
  ), visit_stats as (
    select lower(v.agent_email) as email,
      count(*)::bigint as visits,
      count(*) filter (where v.conversation_result = 'Sudah melakukan pembayaran')::bigint as paid_conversations,
      count(*) filter (where v.conversation_result = 'Bersedia bayar / Promise to Pay')::bigint as promise_to_pay
    from public.visits v
    where ((SELECT public.crl_is_national_superadmin()) OR v.crl_id IN (SELECT crl_id FROM public.customers WHERE upper(btrim(region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin')))
       and v.visit_date >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta') AND v.visit_date < ((p_end_date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    group by lower(v.agent_email)
  ), attendance_stats as (
    select lower(att.agent_email) as email,
      count(*)::bigint as attendance_days,
      round(avg(att.worked_minutes) filter (where att.worked_minutes is not null), 1) as average_worked_minutes
    from public.agent_attendance att
    where (
         public.crl_is_national_superadmin()
         or exists (
           select 1 from public.agents scope_agent
           where lower(scope_agent.email) =
                 lower(att.agent_email)
             and scope_agent.role = 'agent'
             and public.crl_can_access_region(
               scope_agent.region
             )
         )
       )
       and att.attendance_date between p_start_date and p_end_date
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_superadmin_weekly_report(p_start_date date DEFAULT (date_trunc('month'::text, (now() AT TIME ZONE 'Asia/Jakarta'::text)))::date, p_end_date date DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta'::text))::date, p_agent_email text DEFAULT NULL::text)
 RETURNS TABLE(agent_email text, agent_name text, week_start date, week_end date, pre_visits bigint, visits bigint, visit_conversion numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       and ((SELECT public.crl_is_national_superadmin()) OR upper(btrim(a.region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin'))
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
    where ((SELECT public.crl_is_national_superadmin()) OR p.crl_id IN (SELECT crl_id FROM public.customers WHERE upper(btrim(region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin')))
       and p.created_at >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta') AND p.created_at < ((p_end_date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    group by lower(p.agent_email), date_trunc('week', p.created_at at time zone 'Asia/Jakarta')::date
  ),
  visit_stats as (
    select
      lower(v.agent_email) as email,
      date_trunc('week', v.visit_date at time zone 'Asia/Jakarta')::date as week_start,
      count(*)::bigint as visits
    from public.visits v
    where ((SELECT public.crl_is_national_superadmin()) OR v.crl_id IN (SELECT crl_id FROM public.customers WHERE upper(btrim(region)) IN (SELECT cr.region_code FROM public.circle_regions cr JOIN public.agents me ON me.circle_id=cr.circle_id JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active IS TRUE WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin')))
       and v.visit_date >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta') AND v.visit_date < ((p_end_date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
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
$function$
;

CREATE INDEX IF NOT EXISTS crl_customers_region_crl_idx ON public.customers (region,crl_id);
CREATE INDEX IF NOT EXISTS crl_circle_regions_region_idx ON public.circle_regions (circle_id,region_code);
