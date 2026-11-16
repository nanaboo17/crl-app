-- Aggregate field activity at the database rather than transferring thousands
-- of rows through PostgREST. Authorization is enforced inside SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.crl_superadmin_activity_summary_v1(p_kind text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 actor public.agents%ROWTYPE;
 result jsonb;
BEGIN
 SELECT * INTO actor FROM public.agents a
 WHERE lower(a.email)=lower(auth.jwt()->>'email')
   AND a.active IS TRUE AND a.role IN ('admin','superadmin') LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN ('visits','pre_visits') THEN RAISE EXCEPTION 'Invalid report kind'; END IF;
 IF p_kind='visits' AND actor.role<>'superadmin' THEN
   RAISE EXCEPTION 'Superadmin required' USING ERRCODE='42501';
 END IF;

 IF p_kind='visits' THEN
  WITH permitted_agents AS MATERIALIZED (
   SELECT a.email,a.agent_name,a.active
   FROM public.agents a
   WHERE a.organization='Agent'
     AND (actor.role='admin'
       OR actor.circle_id IS NULL
       OR (a.role='agent' AND (
           (a.region IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.circle_regions cr JOIN public.circles ci ON ci.id=cr.circle_id AND ci.active
            WHERE cr.circle_id=actor.circle_id AND cr.region_code=upper(btrim(a.region))
           ))
           OR (a.region IS NULL AND a.circle_id=actor.circle_id)
         )))
  ),
  events AS MATERIALIZED (
   SELECT lower(v.agent_email) agent_email,v.visit_status_kunjungan,v.location_match,v.visit_date
   FROM public.visits v
   JOIN public.customers c ON c.crl_id=v.crl_id
   WHERE actor.role='admin' OR actor.circle_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.circle_regions cr JOIN public.circles ci ON ci.id=cr.circle_id AND ci.active
        WHERE cr.circle_id=actor.circle_id AND cr.region_code=upper(btrim(c.region))
      )
  ),
  stats AS (
   SELECT e.agent_email,count(*)::int total,
     count(*) FILTER (WHERE visit_status_kunjungan='Bertemu dengan pelanggan')::int met,
     count(*) FILTER (WHERE visit_status_kunjungan='Pelanggan tidak ada di tempat')::int absent,
     count(*) FILTER (WHERE location_match IS FALSE)::int gps,
     count(*) FILTER (WHERE (visit_date AT TIME ZONE 'Asia/Jakarta')::date=(now() AT TIME ZONE 'Asia/Jakarta')::date)::int today
   FROM events e GROUP BY e.agent_email
  )
  SELECT jsonb_build_object(
    'agents',coalesce((SELECT jsonb_agg(jsonb_build_object('email',a.email,'agent_name',a.agent_name,'active',a.active,
       'total',coalesce(s.total,0),'met',coalesce(s.met,0),'absent',coalesce(s.absent,0),'gps',coalesce(s.gps,0))
       ORDER BY a.agent_name,a.email) FROM permitted_agents a LEFT JOIN stats s ON s.agent_email=lower(a.email)),'[]'::jsonb),
    'totalVisits',(SELECT count(*) FROM events),
    'gpsMismatches',(SELECT count(*) FROM events WHERE location_match IS FALSE),
    'todayVisits',(SELECT count(*) FROM events WHERE (visit_date AT TIME ZONE 'Asia/Jakarta')::date=(now() AT TIME ZONE 'Asia/Jakarta')::date)
  ) INTO result;
 ELSE
  WITH permitted_agents AS MATERIALIZED (
   SELECT a.email,a.agent_name,a.active FROM public.agents a
   WHERE a.role='agent'
     AND (actor.role='admin' OR actor.circle_id IS NULL
       OR (a.region IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.circle_regions cr JOIN public.circles ci ON ci.id=cr.circle_id AND ci.active
          WHERE cr.circle_id=actor.circle_id AND cr.region_code=upper(btrim(a.region))
       )) OR (a.region IS NULL AND a.circle_id=actor.circle_id))
  ),
  events AS MATERIALIZED (
   SELECT lower(p.agent_email) agent_email,p.previsit_status
   FROM public.pre_visits p
   JOIN public.customers c ON c.crl_id=p.crl_id
   WHERE actor.role='admin' OR actor.circle_id IS NULL
     OR EXISTS (SELECT 1 FROM public.circle_regions cr JOIN public.circles ci ON ci.id=cr.circle_id AND ci.active
          WHERE cr.circle_id=actor.circle_id AND cr.region_code=upper(btrim(c.region)))
  ),
  stats AS (
    SELECT agent_email,count(*)::int total,
    count(*) FILTER (WHERE previsit_status='Ready for Visit')::int ready,
    count(*) FILTER (WHERE previsit_status='Need Follow-up')::int followup,
    count(*) FILTER (WHERE previsit_status='Direct Visit')::int direct,
    count(*) FILTER (WHERE previsit_status='Rescheduled')::int rescheduled,
    count(*) FILTER (WHERE previsit_status='Stopped')::int stopped
    FROM events GROUP BY agent_email
  )
  SELECT jsonb_build_object(
   'agents',coalesce((SELECT jsonb_agg(jsonb_build_object('email',a.email,'agent_name',a.agent_name,'active',a.active,
    'total',coalesce(s.total,0),'ready',coalesce(s.ready,0),'followup',coalesce(s.followup,0),
    'direct',coalesce(s.direct,0),'rescheduled',coalesce(s.rescheduled,0),'stopped',coalesce(s.stopped,0))
    ORDER BY a.agent_name,a.email) FROM permitted_agents a LEFT JOIN stats s ON s.agent_email=lower(a.email)),'[]'::jsonb),
   'totalPreVisits',(SELECT count(*) FROM events),
   'readyCount',(SELECT count(*) FROM events WHERE previsit_status='Ready for Visit'),
   'followUpCount',(SELECT count(*) FROM events WHERE previsit_status='Need Follow-up')
  ) INTO result;
 END IF;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.crl_superadmin_activity_summary_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crl_superadmin_activity_summary_v1(text) TO authenticated;