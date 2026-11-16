CREATE OR REPLACE FUNCTION public.crl_report_attendance_breakdown_v1(p_start_date date,p_end_date date,p_agent_email text DEFAULT NULL)
RETURNS TABLE(agent_email text,on_time_days bigint,late_days bigint,sick_days bigint,permission_days bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.current_role()<>'superadmin' THEN RAISE EXCEPTION 'Superadmin required'; END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date<p_start_date OR p_end_date-p_start_date>366 THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 RETURN QUERY
 WITH staff AS MATERIALIZED (
 SELECT lower(btrim(a.email)) AS email FROM public.agents a WHERE a.role='agent' AND a.active
 AND (p_agent_email IS NULL OR lower(btrim(a.email))=lower(btrim(p_agent_email)))
 AND public.crl_can_access_region(a.region)
 ), attendance AS (
 SELECT lower(btrim(t.agent_email)) email,
 count(DISTINCT t.attendance_date) FILTER (WHERE lower(btrim(coalesce(t.check_in_status,'')))='late' AND t.check_in_at IS NOT NULL)::bigint late,
 count(DISTINCT t.attendance_date) FILTER (WHERE lower(btrim(coalesce(t.check_in_status,'')))<>'late' AND t.check_in_at IS NOT NULL)::bigint ontime
 FROM public.agent_attendance t JOIN staff s ON s.email=lower(btrim(t.agent_email))
 WHERE t.attendance_date BETWEEN p_start_date AND p_end_date GROUP BY 1
 ), leave_days AS (
 SELECT lower(btrim(l.agent_email)) email,
 count(DISTINCT d.day) FILTER (WHERE lower(l.request_type)='sick')::bigint sick,
 count(DISTINCT d.day) FILTER (WHERE lower(l.request_type) IN ('permission','izin'))::bigint permission
 FROM public.agent_leave_requests l JOIN staff s ON s.email=lower(btrim(l.agent_email))
 CROSS JOIN LATERAL generate_series(greatest(l.start_date,p_start_date)::timestamp,least(l.end_date,p_end_date)::timestamp,interval '1 day') d(day)
 WHERE l.status='approved' AND l.start_date<=p_end_date AND l.end_date>=p_start_date
 AND extract(isodow from d.day)<6 GROUP BY 1
 )
 SELECT s.email,coalesce(a.ontime,0),coalesce(a.late,0),coalesce(l.sick,0),coalesce(l.permission,0)
 FROM staff s LEFT JOIN attendance a ON a.email=s.email LEFT JOIN leave_days l ON l.email=s.email;
END $$;
REVOKE ALL ON FUNCTION public.crl_report_attendance_breakdown_v1(date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crl_report_attendance_breakdown_v1(date,date,text) TO authenticated;