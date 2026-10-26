-- First Pre-Visit and First Visit show first event of the current Jakarta day, within the report date window.
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
  SELECT email,count(DISTINCT day)::bigint pv_days,count(DISTINCT (customer_key,day))::bigint customer_days,min(event_time) FILTER (WHERE day = (now() AT TIME ZONE 'Asia/Jakarta')::date) first_pv
  FROM pv GROUP BY email
 ), v_stats AS (
  SELECT email,count(DISTINCT day)::bigint v_days,count(*)::bigint total,
   count(*) FILTER (WHERE visit_status_kunjungan='Bertemu dengan pelanggan')::bigint met_count,
   count(*) FILTER (WHERE conversation_result='Bersedia bayar / Promise to Pay')::bigint ptp_count,
   min(event_time) FILTER (WHERE day = (now() AT TIME ZONE 'Asia/Jakarta')::date) first_v FROM vv GROUP BY email
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
