# CRL Field App v1

Mobile-first CRL field operations app built with Next.js 15 and Supabase.

## Implemented in v1

- Google OAuth sign-in
- Registered-user routing by role: Agent / Admin / Superadmin
- Database-level Row Level Security (RLS)
- Agent mobile dashboard
- Agent-only customer list and customer detail
- One Pre-Visit per customer
- Pre-Visit form + detail
- One Visit per customer
- Visit form with high-accuracy browser GPS, accuracy value, camera/photo upload, mandatory consent, result and summary
- Sequential human-readable IDs generated safely by PostgreSQL: `PRE00001`, `VIS00001`, ...
- Customer status synchronization via database triggers
- Admin dashboard + customer-to-agent assignment + visit monitoring
- Superadmin dashboard + agent/customer/pre-visit/visit management
- Private Supabase Storage bucket for visit evidence

## 1. Create Supabase project

Create a project at Supabase, then open **SQL Editor** and run:

`supabase/schema.sql`

Use a new project/schema for the first setup. The script creates tables, RLS policies, sequences, triggers and the private `visit-evidence` bucket.

## 2. Configure Google Auth

In Supabase: **Authentication → Providers → Google** and enable Google.

Add your local and production URLs to the allowed redirect URLs, including:

- `http://localhost:3000/auth/route`
- `https://YOUR-DOMAIN/auth/route`

## 3. Environment

Copy `.env.example` to `.env.local` and fill:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 4. Create first Superadmin

Before first sign-in, add the first authorized email in Supabase SQL Editor:

```sql
insert into public.agents (email, agent_name, sales_code, role, active)
values ('your-email@gmail.com', 'Your Name', 'SL00001', 'superadmin', true);
```

The Google account email must match exactly (email comparisons in RLS are case-insensitive).

## 5. Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` on desktop or your phone on the same local network.

## Security model

- Unregistered/inactive emails cannot retrieve operational rows.
- Agent receives only customers assigned to their authenticated email.
- Agent receives only their own pre-visits and visits.
- Admin receives all operational rows and can assign customers.
- Superadmin can manage all tables.
- Visit evidence is stored in a private bucket; signed URLs are generated for authorized viewers.

## Important production notes

- GPS requires HTTPS in production (localhost is allowed for development).
- Browser GPS precision depends on the device, environment and user permission. The app stores latitude/longitude as double precision and also stores reported accuracy in meters.
- Photo compression is not implemented yet. Add client-side compression before a large production rollout to control storage and bandwidth costs.
- The current visit form contains the first core fields. SOP-specific conditional branches (retention, signal issue, competitor, relocation, closure/ticket/SLA) are the next implementation phase.
