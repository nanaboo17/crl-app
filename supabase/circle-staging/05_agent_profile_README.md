# Staging-only Circle Agent Management

1. Apply 05_agent_profile_rpc_v2.sql to staging before testing frontend PR.
2. National superadmins and Circle superadmins can edit agent name, organization and active flag.
3. Circle admins are scoped by their account's circle_id and target agent's region.
4. Role, region, circle_id, email and privileges cannot be modified by this RPC.
5. National-only existing creation/deletion/role-management paths require separate guards.
6. Verify National/JAYA/JAVA/agent tests and direct browser API attempts.
7. Eight agents currently have NULL region and must be reviewed by National.
8. Do not deploy the frontend before the RPC exists in the target environment.
9. This RPC is not a substitute for auditing all other SECURITY DEFINER functions and existing RLS.

Rollback:
DROP FUNCTION IF EXISTS public.crl_update_circle_agent_profile_v2(text,text,text,boolean);
