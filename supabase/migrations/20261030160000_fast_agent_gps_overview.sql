CREATE INDEX IF NOT EXISTS agent_location_history_user_latest_idx ON public.agent_location_history(agent_user_id,captured_at DESC);
CREATE INDEX IF NOT EXISTS agent_gps_diagnostics_user_latest_idx ON public.agent_gps_diagnostics(agent_user_id,occurred_at DESC);
CREATE OR REPLACE FUNCTION public.crl_agent_gps_overview_v1()
RETURNS TABLE(agent_user_id uuid,latitude double precision,longitude double precision,accuracy_meters double precision,captured_at timestamptz,received_at timestamptz,tracking boolean,stage text,error_code text,error_message text,occurred_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.agents a WHERE lower(a.email)=lower(auth.jwt()->>'email') AND a.active AND a.role='superadmin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 RETURN QUERY
 SELECT d.id,loc.latitude,loc.longitude,loc.accuracy_meters,loc.captured_at,loc.received_at,
 EXISTS(SELECT 1 FROM public.agent_tracking_sessions s WHERE s.agent_user_id=d.id AND s.status='active'),
 diag.stage,diag.error_code,diag.error_message,diag.occurred_at
 FROM public.crl_circle_agent_location_directory_v2() d
 LEFT JOIN LATERAL (SELECT l.latitude,l.longitude,l.accuracy_meters,l.captured_at,l.received_at FROM public.agent_location_history l WHERE l.agent_user_id=d.id ORDER BY l.captured_at DESC LIMIT 1) loc ON true
 LEFT JOIN LATERAL (SELECT g.stage,g.error_code,g.error_message,g.occurred_at FROM public.agent_gps_diagnostics g WHERE g.agent_user_id=d.id ORDER BY g.occurred_at DESC LIMIT 1) diag ON true;
END $$;
REVOKE ALL ON FUNCTION public.crl_agent_gps_overview_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crl_agent_gps_overview_v1() TO authenticated;