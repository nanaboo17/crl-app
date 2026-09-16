# CRL Field App

CRL Field App is an internal field-operations application for customer retention, collection, pre-visit preparation, field visits, payment monitoring, territory assignment, attendance, and Superadmin reporting.

**Documentation status:** updated 16 September 2026.

## Documentation

- [Full system documentation](docs/CRL_DOCUMENTATION.md)
- [Superadmin operating guide](docs/SUPERADMIN_GUIDE.md)
- [Design system and UI conventions](DESIGN.md)

## Current product scope

The application supports three authenticated roles:

- **Agent** — works assigned customers, completes Pre-Visits and Visits, captures field evidence, and manages follow-up work.
- **Admin** — monitors operational data and agent activity with broader access than Agents.
- **Superadmin** — manages users, customers, territories, attendance, Pre-Visits, Visits, diagnostics, and reports.

Authentication uses Google OAuth through Supabase Auth. Access to operational records is protected by Supabase Row Level Security.

## Core workflow

1. Customer data is loaded into `customers`.
2. Customers can be assigned to Agents through territory and assignment rules.
3. An Agent performs a **Pre-Visit**.
4. A customer may have **multiple Pre-Visit records**. Continued Pre-Visits create a new row and link to the previous record through `previous_previsit_id`.
5. When appropriate, the Agent performs a **Visit** with GPS, location validation, photo evidence, consent, result, conversation outcome, offers, payment planning, and notes.
6. Payment synchronization updates `payment_status` without removing the historical/current `agent_email`.
7. A paid customer with a Visit is marked `agent_fee_eligible = true`.

## Important business rules

### Customer status

`customer_status` is the authoritative CRL workflow status.

`assign_status` and `visit_status` are compatibility mirrors and should not be treated as independent sources of truth:

- assignment source of truth: `agent_email`
- visit source of truth: existence of a row in `visits`
- payment source of truth: `payment_status`

### Agent ownership after payment

A change to `payment_status = 'paid'` **does not clear `agent_email`**. The Agent remains attached to the customer for historical ownership, performance reporting, and fee eligibility.

### Agent fee eligibility

`customers.agent_fee_eligible` is maintained automatically.

It is `true` only when:

```text
payment_status = paid
AND
customer_id exists in visits
```

Otherwise it is `false`.

### Application deletion policy

Customers, Pre-Visits, and Visits are **not deletable through the application**, including by Superadmin. Destructive cleanup must be performed intentionally through authorized Supabase administration/SQL access.

## Superadmin reporting

Superadmin Visits and Pre-Visits support two entry modes:

- **View by Date**
- **View by Agent**

The date views:

- use Jakarta/WIB calendar dates
- show all fields from the corresponding Supabase table
- support Excel-style filtering on every column
- allow multiple column filters at the same time
- export the currently filtered data as CSV through **Generate Report**

See [Superadmin Guide](docs/SUPERADMIN_GUIDE.md) for step-by-step instructions.

## Technology

- Next.js 15
- React 19
- TypeScript
- Supabase Auth, PostgreSQL, RLS, Storage
- Tailwind CSS / daisyUI
- OpenNext configuration for Cloudflare-compatible deployment

## Local development

Create `.env.local` from `.env.example` and provide the public Supabase configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Then run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database changes

Database evolution is stored under:

```text
supabase/migrations/
```

Production database logic should be changed through migrations so the repository and live Supabase schema remain aligned.

## Security notes

- Unregistered or inactive users are blocked from operational access.
- Agents are restricted to their allowed operational data by RLS and application routing.
- Admin and Superadmin access is validated against the `agents` table.
- Visit evidence is stored through Supabase Storage and should remain private to authorized users.
- Application roles do not receive DELETE policies for `customers`, `pre_visits`, or `visits`.
- Do not commit secret/service-role credentials to the repository.

## Timezone

Operational date views and date-based reporting use **Asia/Jakarta (WIB, UTC+7)** unless a field explicitly stores or displays another timezone.
