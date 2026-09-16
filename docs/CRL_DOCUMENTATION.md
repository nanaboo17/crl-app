# CRL Field App — Full System Documentation

_Last revised: 16 September 2026_

## 1. Purpose

CRL Field App supports customer retention and collection field operations. It combines customer assignment, Pre-Visit preparation, physical Visit execution, payment monitoring, Agent attendance, territories, follow-ups, diagnostics, and management reporting in one application.

The system is designed around three roles: Agent, Admin, and Superadmin.

## 2. Roles and access

### Agent

Agents work customers assigned to them. Their main responsibilities are:

- check daily assigned customers
- review customer details and billing context
- complete Pre-Visits
- continue a previous Pre-Visit when more contact attempts are needed
- start a Visit when the workflow allows it
- capture GPS and location validation
- capture Visit evidence and customer conversation results
- create follow-up actions when needed

### Admin

Admins have broader monitoring access than Agents and can review operational activity across multiple Agents. Exact route availability is defined by the application role checks and Supabase RLS policies.

### Superadmin

Superadmins can monitor and administer the operational system, including:

- Agents
- Customers
- Attendance
- Territories
- Pre-Visits
- Visits
- Reports
- Diagnostics

Superadmin does **not** delete Customers, Pre-Visits, or Visits through the application. Those destructive operations are intentionally reserved for authorized Supabase administration.

## 3. Authentication and authorization

The application uses Google OAuth through Supabase Auth.

After authentication, the app checks the authenticated email against `public.agents`.

Important account fields include:

- `email`
- `agent_name`
- `sales_code`
- `role`
- `active`

Users who are not registered or are inactive are blocked from operational routes.

Supabase Row Level Security provides database-level access control in addition to route-level role validation.

## 4. Main database entities

### 4.1 `customers`

The customer table is the operational master record.

Key groups of fields include:

**Identity and contact**

- `customer_id`
- `customer_name`
- `phone_number`
- `alternative_phone_1`
- `alternative_phone_2`
- `alternative_phone_3`

**Address and territory**

- `service_address`
- `region`
- `city`
- `district`
- `sub_district`
- `given_latitude`
- `given_longitude`
- `site_id`
- `territory`

**Billing and payment**

- `product`
- `invoice_amount`
- `outstanding_amount`
- `invoice_date`
- `payment_due_date`
- `unpaid_since`
- `billing_cycle`
- `payment_status`
- `payment_source_actual_bill_dtm`
- `payment_synced_at`

**Retention and churn**

- `suspension_date`
- `estimated_churn_date`
- `days_left_to_churn`
- `customer_tenure`
- `recommended_offer`
- `maximum_offer`
- `priority_rank`

**Sales hierarchy**

- `ae_name`
- `tl_name`
- `sm_name`
- `sales_channel`

**CRL workflow and assignment**

- `agent_email`
- `assignment_date`
- `customer_status`
- `assign_status`
- `visit_status`
- `agent_fee_eligible`

### 4.2 Status source-of-truth rules

The status fields do not have equal authority.

- `customer_status` = authoritative CRL workflow status
- `agent_email` = authoritative assignment/ownership field
- existence of a record in `visits` = authoritative evidence that a Visit exists
- `payment_status` = authoritative payment state
- `assign_status` = compatibility mirror
- `visit_status` = compatibility mirror

Do not build new business logic that treats `assign_status` or `visit_status` as an independent source of truth.

### 4.3 Payment and Agent ownership

When a customer changes to `payment_status = 'paid'`, the system keeps `agent_email`.

This is intentional because the Agent relationship is needed for:

- historical ownership
- reporting
- Agent performance analysis
- Agent fee eligibility

The application must not use payment status alone to erase Agent ownership.

### 4.4 Agent fee eligibility

`customers.agent_fee_eligible` is a boolean maintained automatically.

Eligibility rule:

```text
payment_status = paid
AND
customer_id exists in visits
```

If both conditions are true, `agent_fee_eligible = true`.

If either condition is false, it is `false`.

The value is kept synchronized when payment status or Visit existence changes.

## 5. Pre-Visit model

Table: `public.pre_visits`

A customer can have **multiple Pre-Visit records**.

This is important for customers who need multiple contact attempts, rescheduling, or continuation before a field Visit.

### 5.1 Continuation behavior

When an Agent opens Pre-Visit for a customer who already has a previous record:

- the latest Pre-Visit is loaded
- previous answers are prefilled
- the Agent can change the information
- saving creates a **new** Pre-Visit row
- the new row links to the previous row through `previous_previsit_id`

The old record remains unchanged as history.

### 5.2 Duplicate submission protection

The database protects against rapid accidental duplicate submissions. A changed continuation is allowed, while a repeated identical submission in the duplicate-protection window can be blocked.

### 5.3 Pre-Visit decision flow

The Pre-Visit form supports contact and field-readiness decisions, including:

- phone contacted / unable to contact
- customer availability
- rescheduling
- direct visit decision
- address confirmation
- appointment information
- unpaid reason
- notes

When the customer cannot be contacted, the Agent can still choose a direct-visit path when appropriate.

### 5.4 Typical Pre-Visit statuses

Supported statuses include values such as:

- Pending
- Contacting Customer
- Need Reschedule
- Rescheduled
- Safety Check
- Ready for Visit
- Direct Visit
- Visit in Progress
- Stopped
- Ended
- Need Follow-up
- Supervisor Review
- Cancelled

The current customer workflow uses the latest relevant Pre-Visit state.

## 6. Visit model

Table: `public.visits`

Current Visit fields include:

- `visit_id`
- `customer_id`
- `agent_email`
- `sales_code`
- `visit_date`
- `customer_phone`
- `updated_phone`
- `visit_address`
- `latitude`
- `longitude`
- `gps_accuracy`
- `gps_captured_at`
- `visit_photo_url`
- `consent_given`
- `visit_result`
- `visit_summary`
- `created_at`
- `distance_to_customer_meters`
- `location_match`
- `visit_status_kunjungan`
- `conversation_result`
- `approved_offer`
- `planned_payment_date`
- `unpaid_reason`
- `additional_notes`

The Visit workflow stores field evidence and conversation outcomes, not only a simple visited/not-visited flag.

## 7. Customer workflow

A simplified workflow is:

```text
Customer assigned
→ Pre-Visit
→ Ready for Visit / Direct Visit
→ Visit
→ Follow-up and/or Payment
```

`customer_status` reflects the overall CRL stage. Supporting tables provide the detailed history behind that status.

## 8. Customer assignment behavior

`agent_email` is the current/historical CRL Agent owner.

Assignment refresh rules must preserve an existing Agent relationship for paid customers and must not remove an Agent merely because a customer belongs to a duplicate household/account group.

Active unpaid customers may be assigned based on territory rules when an appropriate active Agent exists.

If no valid territory Agent is available, the customer may remain without an Agent until the territory configuration is completed.

## 9. Attendance

Table: `public.agent_attendance`

Attendance stores check-in/check-out information including timestamps, GPS information, photos, status, and worked minutes.

Some field actions require valid daily attendance before an Agent may submit Pre-Visit or Visit activity.

## 10. Territories

Territories map operational areas to Agents.

Relevant tables include:

- `territories`
- `territory_sites`
- `territory_homepasses`

Customer assignment logic may use customer territory information together with active territory ownership.

## 11. Follow-ups

Table: `customer_followups`

Follow-ups can store:

- Agent
- Customer
- due date/time
- note
- status
- follow-up type
- source information
- optional calendar sync metadata

Follow-ups help Agents manage pending calls, appointments, payment promises, and revisits.

## 12. Diagnostics

Table: `field_form_diagnostic_logs`

The diagnostics surface records field-form failures and useful technical context such as:

- form type
- stage
- severity
- request method/target
- HTTP status
- error code/message/details/hint
- page path
- connectivity state
- user agent
- metadata

Superadmin can use Diagnostics to troubleshoot field submission problems.

## 13. Superadmin Visits

Opening Superadmin Visits presents a view chooser modal with:

- **View by Date**
- **View by Agent**

Both Visits and Pre-Visits use the same modal visual pattern.

### View by Agent

The existing Agent monitor remains available. It includes Agent-level filters, Visit counts, and drill-down pages.

### View by Date

Route pattern:

```text
/superadmin/visits/date?date=YYYY-MM-DD
```

The date is interpreted in Asia/Jakarta/WIB.

The page loads the full Visit rows for the selected date using `select('*')` and displays all current Visit fields.

Every table column has an Excel-style filter control. Filters support:

- unique-value selection
- multiple selected values
- search inside a column's value list
- multiple active column filters at once
- clearing one filter
- clearing all filters

**Generate Report** exports the currently filtered rows as CSV. With no active filters, it exports all rows for the selected date.

## 14. Superadmin Pre-Visits

Opening Superadmin Pre-Visits presents the same style chooser modal:

- **View by Date**
- **View by Agent**

### View by Date

Route pattern:

```text
/superadmin/pre-visits/date?date=YYYY-MM-DD
```

The page loads all Pre-Visit fields for the selected Jakarta/WIB date and provides the same Excel-style filtering behavior as the Visit date view.

**Generate Report** exports the currently filtered Pre-Visit rows as CSV.

### View by Agent

The existing Agent monitor remains available. Once the user selects `mode=agent`, pagination and filter links preserve Agent mode so the view chooser does not reopen unexpectedly.

## 15. Application deletion policy

The application intentionally has no DELETE RLS policies for:

- `customers`
- `pre_visits`
- `visits`

This includes Superadmin application sessions.

Deletion, cleanup, or destructive correction must be performed deliberately through authorized Supabase administrative access.

This protects operational history from accidental removal in the app.

## 16. Reporting rules

Date-based reporting uses Jakarta/WIB date boundaries.

Reports generated from the date views are CSV files intended for spreadsheet tools such as Excel.

Important behavior:

- data source is the live Supabase table
- visible fields match the corresponding full table field list
- active Excel-style table filters also control report output
- report generation is client-side from the rows already loaded for that date

## 17. Timezone

The operational timezone is:

```text
Asia/Jakarta (WIB / UTC+7)
```

Database timestamps use timezone-aware PostgreSQL values (`timestamptz`) where applicable. Date views explicitly calculate WIB day boundaries before querying.

## 18. Technology architecture

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- daisyUI
- lucide-react

### Backend

- Supabase PostgreSQL
- Supabase Auth
- Supabase Row Level Security
- Supabase Storage
- PostgreSQL functions and triggers

### Deployment

The repository contains OpenNext configuration for Cloudflare-compatible Next.js deployment. Deployment status should be verified from the actual deployment provider rather than inferred only from a GitHub commit.

## 19. Database migrations

Schema changes live in:

```text
supabase/migrations/
```

Recent areas covered by migrations include:

- multiple Pre-Visits per customer
- Pre-Visit continuation linkage
- duplicate submission protection
- restricted application deletes
- derived assignment and Visit compatibility statuses
- preservation of Agent ownership after payment
- preservation of unpaid Agent assignments
- Agent fee eligibility

All future schema/business-rule changes should also be represented by migrations.

## 20. Security model

Key principles:

- Google-authenticated users must also exist as active application users.
- RLS protects operational tables.
- Agent access is scoped to permitted operational rows.
- Superadmin routes validate the Superadmin role.
- Customers, Pre-Visits, and Visits are not deleted through normal app roles.
- Direct execution permissions for sensitive database functions should be restricted where appropriate.
- Secrets must not be committed to source control.

## 21. Development setup

Required public environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Install and run:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## 22. Operational data integrity rules

When extending the app, preserve these rules:

1. Do not erase `agent_email` merely because `payment_status` becomes paid.
2. Determine Visit existence from `visits`, not `customers.visit_status`.
3. Determine Agent ownership from `customers.agent_email`, not `assign_status`.
4. Allow multiple Pre-Visits and preserve their history.
5. Link continued Pre-Visits through `previous_previsit_id`.
6. Keep `agent_fee_eligible` synchronized with paid status + Visit existence.
7. Do not add application DELETE capability for Customers, Pre-Visits, or Visits unless the business rule is explicitly changed.
8. Use Asia/Jakarta boundaries for date-based operational reporting.
9. Keep repository migrations aligned with production Supabase changes.

## 23. Documentation maintenance

When behavior changes, update:

- `README.md` for the product summary and critical rules
- `docs/CRL_DOCUMENTATION.md` for system behavior and architecture
- `docs/SUPERADMIN_GUIDE.md` for Superadmin workflows
- `DESIGN.md` when the UI pattern or visual language changes
