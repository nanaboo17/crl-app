-- Scoped distinct CRL case counts for Agent Productivity and Review
CREATE OR REPLACE FUNCTION public.crl_agent_funnel_counts_v1(p_start_date date, p_end_date date, p_agent_email text DEFAULT NULL::text)
 RETURNS TABLE(agent_email text, unique_previsits bigint, unique_met bigint, unique_ptp bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF public.current_role() <> 'superadmin' THEN RAISE EXCEPTION 'Superadmin required'; END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date<p_start_date OR p_end_date-p_start_date>366 THEN RAISE EXCEPTION 'Invalid dates'; END IF;
 RETURN QUERY
 WITH scope_agents AS (
  SELECT lower(a.email) AS email FROM public.agents a
  WHERE a.active AND a.role='agent'
    AND (p_agent_email IS NULL OR lower(a.email)=lower(p_agent_email))
    AND public.crl_can_access_region(a.region)
 ), p AS (
  SELECT lower(v.agent_email) email,count(DISTINCT v.crl_id)::bigint n
  FROM public.pre_visits v JOIN scope_agents a ON a.email=lower(v.agent_email)
  WHERE v.created_at >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta')
    AND v.created_at < ((p_end_date+1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    AND EXISTS(SELECT 1 FROM public.customers c WHERE c.crl_id=v.crl_id AND public.crl_can_access_region(c.region))
  GROUP BY 1
 ), v AS (
  SELECT lower(x.agent_email) email,
   count(DISTINCT x.crl_id) FILTER (WHERE x.visit_status_kunjungan='Bertemu dengan pelanggan')::bigint met,
   count(DISTINCT x.crl_id) FILTER (WHERE x.conversation_result='Bersedia bayar / Promise to Pay')::bigint ptp
  FROM public.visits x JOIN scope_agents a ON a.email=lower(x.agent_email)
  WHERE x.visit_date >= (p_start_date::timestamp AT TIME ZONE 'Asia/Jakarta')
    AND x.visit_date < ((p_end_date+1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    AND EXISTS(SELECT 1 FROM public.customers c WHERE c.crl_id=x.crl_id AND public.crl_can_access_region(c.region))
  GROUP BY 1
 )
 SELECT a.email,coalesce(p.n,0),coalesce(v.met,0),coalesce(v.ptp,0)
 FROM scope_agents a LEFT JOIN p ON p.email=a.email LEFT JOIN v ON v.email=a.email;
END $function$
;
REVOKE ALL ON FUNCTION public.crl_agent_funnel_counts_v1(date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crl_agent_funnel_counts_v1(date,date,text) TO authenticated;
