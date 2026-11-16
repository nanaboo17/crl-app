-- STAGING ONLY: versioned Circle RPCs, no existing production functions replaced.
CREATE OR REPLACE FUNCTION public.crl_circle_report_payment_conversions_v2(p_start_date date,p_end_date date,p_agent_email text DEFAULT NULL)
RETURNS TABLE(agent_email text,paid_after_visit bigint,paid_after_previsit bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.agents a WHERE lower(a.email)=lower(auth.jwt()->>'email') AND a.active AND a.role='superadmin')
 THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date<p_start_date OR p_end_date-p_start_date>366
 THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 RETURN QUERY
 WITH paid AS (
 SELECT c.crl_id,c.payment_date FROM public.customers c
 WHERE lower(coalesce(c.payment_status,''))='paid' AND c.payment_date IS NOT NULL
 AND public.crl_can_access_region(c.region)
 ), events AS (
 SELECT v.crl_id,v.agent_email,v.visit_date AS event_time,'visit'::text AS kind FROM public.visits v WHERE v.visit_date IS NOT NULL
 UNION ALL
 SELECT pv.crl_id,pv.agent_email,pv.contact_attempt_date,'previsit'::text FROM public.pre_visits pv WHERE pv.contact_attempt_date IS NOT NULL
 ), attributed AS (
 SELECT p.crl_id,ev.agent_email,ev.kind FROM paid p
 CROSS JOIN LATERAL (
 SELECT e.agent_email,e.event_time,e.kind FROM events e
 JOIN public.agents a ON lower(a.email)=lower(e.agent_email)
 WHERE e.crl_id=p.crl_id AND e.event_time<=p.payment_date AND a.role='agent'
 AND (public.crl_is_national_superadmin() OR public.crl_can_access_region(a.region))
 ORDER BY (e.kind='visit') DESC,e.event_time DESC LIMIT 1
 ) ev
 WHERE (ev.event_time AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_start_date AND p_end_date
 AND (p_agent_email IS NULL OR lower(trim(ev.agent_email))=lower(trim(p_agent_email)))
 )
 SELECT lower(trim(a.agent_email)),
 count(DISTINCT a.crl_id) FILTER(WHERE a.kind='visit')::bigint,
 count(DISTINCT a.crl_id) FILTER(WHERE a.kind='previsit')::bigint
 FROM attributed a GROUP BY 1;
END $$;

CREATE OR REPLACE FUNCTION public.crl_circle_visit_locations_v2(p_start_date date,p_end_date date,p_agent_email text)
RETURNS TABLE(crl_id text,visit_date timestamptz,latitude double precision,longitude double precision)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.agents a WHERE lower(a.email)=lower(auth.jwt()->>'email') AND a.active AND a.role='superadmin')
 THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_agent_email IS NULL OR p_end_date<p_start_date OR p_end_date-p_start_date>366
 THEN RAISE EXCEPTION 'Invalid arguments'; END IF;
 RETURN QUERY SELECT v.crl_id,v.visit_date,v.latitude,v.longitude
 FROM public.visits v JOIN public.customers c ON c.crl_id=v.crl_id
 JOIN public.agents a ON lower(a.email)=lower(v.agent_email)
 WHERE lower(v.agent_email)=lower(trim(p_agent_email))
 AND public.crl_can_access_region(c.region)
 AND (public.crl_is_national_superadmin() OR public.crl_can_access_region(a.region))
 AND (v.visit_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_start_date AND p_end_date
 ORDER BY v.visit_date DESC LIMIT 2000;
END $$;

CREATE OR REPLACE FUNCTION public.crl_circle_agent_location_directory_v2()
RETURNS TABLE(id uuid,email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.agents a WHERE lower(a.email)=lower(auth.jwt()->>'email') AND a.active AND a.role='superadmin')
 THEN RAISE EXCEPTION 'Not authorized'; END IF;
 RETURN QUERY SELECT u.id,u.email::text FROM auth.users u
 JOIN public.agents a ON lower(a.email)=lower(u.email)
 WHERE a.role='agent' AND a.active
 AND (public.crl_is_national_superadmin() OR public.crl_can_access_region(a.region));
END $$;

REVOKE ALL ON FUNCTION public.crl_circle_report_payment_conversions_v2(date,date,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crl_circle_visit_locations_v2(date,date,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crl_circle_agent_location_directory_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crl_circle_report_payment_conversions_v2(date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crl_circle_visit_locations_v2(date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crl_circle_agent_location_directory_v2() TO authenticated;
