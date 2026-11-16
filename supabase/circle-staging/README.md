# Circle RPCs: staging-only
This change adds versioned RPCs without replacing production functions.
The three functions scope paid conversion, visit locations, and GPS user directory to Circle regions. National superadmins continue seeing all circles.

## Preconditions and blockers
- Test as genuinely authenticated JAYA, JAVA, National, and agent accounts. SQL editor sessions are not sufficient.
- Verify agents.region matches their authorized Circle, including cross-region agents.
- Audit all existing SECURITY DEFINER RPCs, especially reports, user creation, and assignments. Old endpoints remain unrestricted.
- Replace broad permissive RLS policies and secure attendance, GPS history, storage, CSV exports, and server routes.
- Customer uploads remain National only; maintain existing service-role automation.
- Unknown regions must be National-only.
- Only switch frontend endpoints after the entire access surface passes staging QA.

## Test matrix
JAYA: JAYA allowed; JAVA/SUMATRA denied.
JAVA: JAVA allowed; JAYA/SUMATRA denied.
National: all accessible.
Agent/anonymous: RPC access denied.
Other Circle p_agent_email: return zero rows.
Unknown region: denied except National.

## Rollback
DROP FUNCTION IF EXISTS public.crl_circle_report_payment_conversions_v2(date,date,text);
DROP FUNCTION IF EXISTS public.crl_circle_visit_locations_v2(date,date,text);
DROP FUNCTION IF EXISTS public.crl_circle_agent_location_directory_v2();

Not a complete production security rollout.
