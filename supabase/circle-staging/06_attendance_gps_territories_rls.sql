-- STAGING REVIEW ONLY. Activating this changes RLS behavior; test with real sessions before production.
-- Caller must never be able to spoof agent_user_id or Circle.
CREATE OR REPLACE FUNCTION public.crl_can_access_agent_email(p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT public.crl_is_national_superadmin()
 OR EXISTS (
  SELECT 1 FROM public.agents target
  WHERE lower(target.email)=lower(p_email)
    AND target.role='agent'
    AND public.crl_can_access_region(target.region)
 );
$$;
REVOKE ALL ON FUNCTION public.crl_can_access_agent_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crl_can_access_agent_email(text) TO authenticated;

-- Existing permissive SELECT policies must be replaced, not supplemented.
DROP POLICY IF EXISTS "agents read own attendance; admins read all" ON public.agent_attendance;
CREATE POLICY "crl_circle_attendance_read" ON public.agent_attendance
FOR SELECT TO authenticated USING (
 lower(agent_email)=lower(public.current_email())
 OR public.current_role()='admin'
 OR (public.current_role()='superadmin' AND public.crl_can_access_agent_email(agent_email))
);

DROP POLICY IF EXISTS "tracking_agent_read_locations" ON public.agent_location_history;
CREATE POLICY "crl_circle_gps_history_read" ON public.agent_location_history
FOR SELECT TO authenticated USING (
 agent_user_id=(SELECT auth.uid())
 OR (
  public.current_role()='superadmin'
  AND EXISTS (
   SELECT 1 FROM auth.users u
   WHERE u.id=agent_user_id
   AND public.crl_can_access_agent_email(u.email::text)
  )
 )
);

-- Preserve existing admin behavior; add Circle filtering for superadmins.
DROP POLICY IF EXISTS "territories_select" ON public.territories;
CREATE POLICY "crl_circle_territories_select" ON public.territories
FOR SELECT TO authenticated USING (
 lower(agent_email)=lower(public.current_email())
 OR public.current_role()='admin'
 OR (public.current_role()='superadmin' AND public.crl_can_access_region(region))
);
DROP POLICY IF EXISTS "territories_insert" ON public.territories;
CREATE POLICY "crl_circle_territories_insert" ON public.territories
FOR INSERT TO authenticated WITH CHECK (
 public.current_role()='admin'
 OR (public.current_role()='superadmin' AND public.crl_can_access_region(region)
     AND (agent_email IS NULL OR public.crl_can_access_agent_email(agent_email)))
);
DROP POLICY IF EXISTS "territories_update" ON public.territories;
CREATE POLICY "crl_circle_territories_update" ON public.territories
FOR UPDATE TO authenticated
USING (
 public.current_role()='admin'
 OR (public.current_role()='superadmin' AND public.crl_can_access_region(region))
)
WITH CHECK (
 public.current_role()='admin'
 OR (public.current_role()='superadmin' AND public.crl_can_access_region(region)
     AND (agent_email IS NULL OR public.crl_can_access_agent_email(agent_email)))
);
DROP POLICY IF EXISTS "territories_delete" ON public.territories;
CREATE POLICY "crl_circle_territories_delete" ON public.territories
FOR DELETE TO authenticated USING (
 public.current_role()='admin'
 OR (public.current_role()='superadmin' AND public.crl_can_access_region(region))
);
