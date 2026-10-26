-- Optimize distinct visited case reporting while retaining Circle agent and customer region access.
CREATE OR REPLACE FUNCTION public.crl_report_visited_customer_counts(p_start_date date, p_end_date date, p_agent_email text DEFAULT NULL::text)
 RETURNS TABLE(agent_email text, visited_customers bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF NOT public.crl_tracking_role('superadmin') THEN RAISE EXCEPTION 'Superadmin required'; END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date<p_start_date OR p_end_date-p_start_date>366 THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 RETURN QUERY
 WITH permitted_regions AS MATERIALIZED (
  SELECT cr.region_code FROM public.circle_regions cr
  JOIN public.agents me ON me.circle_id=cr.circle_id
  JOIN public.circles cir ON cir.id=cr.circle_id AND cir.active
  WHERE lower(me.email)=lower(auth.jwt()->>'email') AND me.active AND me.role='superadmin'
 ), allowed_agents AS MATERIALIZED (
  SELECT lower(trim(a.email)) email
  FROM public.agents a WHERE a.role='agent' AND a.active
   AND (p_agent_email IS NULL OR lower(trim(a.email))=lower(trim(p_agent_email)))
   AND (public.crl_is_national_superadmin() OR upper(btrim(a.region)) IN (SELECT region_code FROM permitted_regions))
 )
 SELECT lower(trim(v.agent_email))::text,count(DISTINCT v.crl_id)::bigint
 FROM public.visits v
 JOIN allowed_agents a ON a.email=lower(trim(v.agent_email))
 JOIN public.customers c ON c.crl_id=v.crl_id
 WHERE v.visit_date >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta')
   AND v.visit_date < ((p_end_date+1)::timestamp AT TIME ZONE 'Asia/Jakarta')
   AND (public.crl_is_national_superadmin() OR upper(btrim(c.region)) IN (SELECT region_code FROM permitted_regions))
 GROUP BY lower(trim(v.agent_email));
END $function$
;
REVOKE ALL ON FUNCTION public.crl_report_visited_customer_counts(date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crl_report_visited_customer_counts(date,date,text) TO authenticated;
CREATE INDEX IF NOT EXISTS crl_visits_date_agent_case_idx ON public.visits(visit_date,agent_email,crl_id);
