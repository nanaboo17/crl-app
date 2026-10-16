-- STAGING ONLY: install in staging before merging frontend changes.
-- Circle superadmins can edit non-sensitive fields of agents in their Circle.
-- The RPC rejects changes to roles, regions, circle ownership or email.
CREATE OR REPLACE FUNCTION public.crl_update_circle_agent_profile_v2(
  p_agent_email text,
  p_agent_name text,
  p_organization text,
  p_active boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_actor public.agents%ROWTYPE;
  v_target public.agents%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.agents
   WHERE lower(email)=lower(auth.jwt()->>'email') AND active IS TRUE AND role='superadmin';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_agent_email IS NULL OR nullif(btrim(p_agent_name),'') IS NULL THEN
    RAISE EXCEPTION 'Agent email and name are required';
  END IF;
  SELECT * INTO v_target FROM public.agents
   WHERE lower(email)=lower(btrim(p_agent_email)) FOR UPDATE;
  IF NOT FOUND OR v_target.role <> 'agent' THEN RAISE EXCEPTION 'Agent is not editable'; END IF;
  IF v_actor.circle_id IS NOT NULL AND
     NOT public.crl_can_access_region(v_target.region)
  THEN RAISE EXCEPTION 'Agent is outside your Circle'; END IF;
  UPDATE public.agents SET
    agent_name=btrim(p_agent_name),
    organization=nullif(btrim(p_organization),''),
    active=coalesce(p_active,v_target.active)
   WHERE email=v_target.email;
END $$;
REVOKE ALL ON FUNCTION public.crl_update_circle_agent_profile_v2(text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crl_update_circle_agent_profile_v2(text,text,text,boolean) TO authenticated;
