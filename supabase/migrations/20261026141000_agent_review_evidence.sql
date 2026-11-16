CREATE OR REPLACE FUNCTION public.crl_agent_review_evidence_v1(p_agent_email text,p_start_date date,p_end_date date)
RETURNS TABLE(activity_date date,issue text,check_in_at timestamptz,check_out_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.current_role()<>'superadmin' THEN RAISE EXCEPTION 'Superadmin required'; END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date<p_start_date OR p_end_date-p_start_date>366 THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.agents a WHERE lower(btrim(a.email))=lower(btrim(p_agent_email)) AND a.role='agent' AND public.crl_can_access_region(a.region)) THEN RAISE EXCEPTION 'Agent outside permitted scope'; END IF;
 RETURN QUERY
 WITH att AS MATERIALIZED (
  SELECT t.attendance_date AS day,t.check_in_at AS ci,t.check_out_at AS co,t.check_in_status AS ci_status
  FROM public.agent_attendance t WHERE lower(btrim(t.agent_email))=lower(btrim(p_agent_email))
    AND t.attendance_date BETWEEN p_start_date AND p_end_date AND t.check_in_at IS NOT NULL
 ), flags AS (
  SELECT a.day,'late'::text issue,a.ci,a.co FROM att a WHERE lower(btrim(coalesce(a.ci_status,'')))='late'
  UNION ALL
  SELECT a.day,'missing_checkout'::text,a.ci,a.co FROM att a WHERE a.co IS NULL AND a.day<(now() AT TIME ZONE 'Asia/Jakarta')::date
  UNION ALL
  SELECT a.day,'no_recorded_activity'::text,a.ci,a.co FROM att a
  WHERE NOT EXISTS(
   SELECT 1 FROM public.pre_visits p WHERE lower(btrim(p.agent_email))=lower(btrim(p_agent_email))
    AND p.contact_attempt_date>=(a.day::timestamp AT TIME ZONE 'Asia/Jakarta')
    AND p.contact_attempt_date<((a.day+1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    AND public.crl_can_access_customer(p.crl_id)
  ) AND NOT EXISTS(
   SELECT 1 FROM public.visits v WHERE lower(btrim(v.agent_email))=lower(btrim(p_agent_email))
    AND v.visit_date>=(a.day::timestamp AT TIME ZONE 'Asia/Jakarta')
    AND v.visit_date<((a.day+1)::timestamp AT TIME ZONE 'Asia/Jakarta')
    AND public.crl_can_access_customer(v.crl_id)
  )
 )
 SELECT f.day,f.issue,f.ci,f.co FROM flags f ORDER BY f.day DESC,f.issue LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION public.crl_agent_review_evidence_v1(text,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crl_agent_review_evidence_v1(text,date,date) TO authenticated;