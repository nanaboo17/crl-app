# Circle Attendance, GPS, Territories: staging-first migration

This script is NOT active. It replaces existing permissive policies and therefore must not be run against the live database without authenticated validation.

Verify:
1. National sees all agents, locations, attendance and territories.
2. JAYA sees JABO 1/JABO 2/WJ only; JAVA sees EJ/CJ only.
3. JAYA and JAVA cannot query another Circle by user ID, email, attendance ID or territory ID.
4. Agent sees only their own attendance and own tracking history.
5. GPS inserts continue to work (INSERT tracking policy is intentionally unchanged).
6. Regionless agents are National-only to administrators; regionless territories are National-only.
7. Territory reassignment rejects out-of-Circle agent.
8. All current elevated RPCs and storage/exports/API handlers still require hardening. Do NOT treat this as complete security enforcement.

Note: legacy role=admin broad grants are preserved for compatibility. The admin role must be audited separately.
Before production: capture existing policies for rollback, then simulate policy behavior using real authenticated sessions. Also review SECURITY DEFINER functions and RLS of agent_tracking_sessions.
