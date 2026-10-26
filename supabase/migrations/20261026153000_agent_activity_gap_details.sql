CREATE OR REPLACE FUNCTION public.crl_agent_activity_gaps_v1(p_agent_email text, p_start_date date, p_end_date date)
 RETURNS TABLE(activity_date date, start_time timestamp with time zone, end_time timestamp with time zone, gap_minutes numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF public.current_role()<>'superadmin' THEN RAISE EXCEPTION 'Superadmin required'; END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date<p_start_date OR p_end_date-p_start_date>366 THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.agents a WHERE lower(a.email)=lower(btrim(p_agent_email)) AND a.role='agent' AND public.crl_can_access_region(a.region)) THEN RAISE EXCEPTION 'Agent outside permitted scope'; END IF;
 RETURN QUERY WITH events AS (
 SELECT lower(a.agent_email) AS email,a.attendance_date AS day,a.check_in_at AS at FROM public.agent_attendance a WHERE lower(a.agent_email)=lower(btrim(p_agent_email)) AND a.attendance_date BETWEEN p_start_date AND p_end_date AND a.check_in_at IS NOT NULL
 UNION ALL SELECT lower(p.agent_email),(p.contact_attempt_date AT TIME ZONE 'Asia/Jakarta')::date,p.contact_attempt_date FROM public.pre_visits p WHERE lower(p.agent_email)=lower(btrim(p_agent_email)) AND p.contact_attempt_date >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta') AND p.contact_attempt_date < ((p_end_date+1)::timestamp AT TIME ZONE 'Asia/Jakarta') AND public.crl_can_access_customer(p.crl_id)
 UNION ALL SELECT lower(v.agent_email),(v.visit_date AT TIME ZONE 'Asia/Jakarta')::date,v.visit_date FROM public.visits v WHERE lower(v.agent_email)=lower(btrim(p_agent_email)) AND v.visit_date >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta') AND v.visit_date < ((p_end_date+1)::timestamp AT TIME ZONE 'Asia/Jakarta') AND public.crl_can_access_customer(v.crl_id)
 ), ordered AS (
 SELECT e.day,e.at,lag(e.at) OVER(PARTITION BY e.email,e.day ORDER BY e.at) AS previous_at FROM events e
 )
 SELECT o.day,o.previous_at,o.at,round((extract(epoch FROM (o.at-o.previous_at))/60)::numeric,1)
 FROM ordered o WHERE o.previous_at IS NOT NULL AND o.at-o.previous_at>interval '3 hours' ORDER BY o.day DESC,o.at DESC LIMIT 100;
END $function$
;
REVOKE ALL ON FUNCTION public.crl_agent_activity_gaps_v1(text,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crl_agent_activity_gaps_v1(text,date,date) TO authenticated;
