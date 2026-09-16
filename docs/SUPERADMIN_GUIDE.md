# CRL Field App — Superadmin Guide

_Last revised: 16 September 2026_

This guide explains how Superadmin should operate the current CRL Field App. It focuses on day-to-day use, monitoring, reporting, and safe administration.

## 1. Superadmin responsibilities

Superadmin is responsible for system-wide operational visibility and administration, including:

- Agents
- Customers
- Attendance
- Territories
- Pre-Visits
- Visits
- Reports
- Diagnostics

Superadmin has broad visibility, but some destructive actions are intentionally not available in the application.

## 2. Important rule: do not delete operational history in the app

Customers, Pre-Visits, and Visits cannot be deleted through the CRL application, even by Superadmin.

If a record must be removed because it is invalid test data or requires administrative cleanup, use authorized Supabase administration/SQL access and confirm the impact before deletion.

This protects field history from accidental removal.

## 3. Dashboard

The Superadmin dashboard provides a high-level operational overview and links to the major management areas.

Use the dashboard to identify areas that need review, then open the relevant module for detail.

## 4. Agents

Use the Agents area to review registered CRL users and Agent account information.

Important fields include:

- email
- Agent name
- sales code
- role
- active/inactive status

An Agent must be registered and active to access operational Agent routes.

### Agent ownership and payment

Do not interpret a paid customer as an unassigned customer.

When a customer becomes paid, the system intentionally keeps `agent_email` so the Agent relationship remains available for reporting and Agent fee eligibility.

## 5. Customers

The Customers area is the master operational customer list.

Important customer information includes:

- customer identity
- contact numbers
- address and location
- product
- outstanding amount
- invoice and payment information
- churn timing
- priority
- retention offers
- territory
- assigned Agent
- workflow status
- Agent fee eligibility

### Status interpretation

Use these fields as the main sources of truth:

- **Workflow:** `customer_status`
- **Agent ownership:** `agent_email`
- **Payment:** `payment_status`
- **Visit performed:** check whether the customer exists in the Visits table

`assign_status` and `visit_status` are compatibility mirrors. They should not be treated as stronger evidence than the source fields above.

## 6. Agent Fee eligibility

The customer field `agent_fee_eligible` identifies cases that meet the current fee rule.

The value becomes `true` when:

```text
payment_status = paid
AND
customer_id exists in visits
```

Examples:

| Payment | Visit exists | Agent fee eligible |
|---|---:|---:|
| unpaid | No | false |
| unpaid | Yes | false |
| paid | No | false |
| paid | Yes | true |

The Agent remains attached through `agent_email` when payment becomes paid.

## 7. Attendance

Use Attendance to review daily Agent attendance and field-readiness data.

Attendance can include:

- attendance date
- check-in time
- check-in GPS
- check-in accuracy
- check-in photo
- check-in status
- check-out time
- check-out GPS
- check-out photo
- worked minutes

Some Agent field actions require valid attendance before submission.

When an Agent reports that Pre-Visit or Visit submission is blocked, check Attendance as part of troubleshooting.

## 8. Territories

Territories determine operational ownership by area.

Use Territories to review which active Agent is responsible for each operational territory.

If an unpaid customer has no Agent and the assignment logic cannot find an active Agent for the customer's territory, the customer may remain unassigned until territory ownership is configured.

Changing territory ownership should be done carefully because it can affect active unpaid/unvisited workload assignment.

Paid customers keep their historical Agent relationship.

## 9. Pre-Visits overview

Pre-Visits are preparation/contact records before a physical field Visit.

A customer can have **multiple Pre-Visits**.

This allows CRL to preserve contact history instead of overwriting the previous attempt.

A continued Pre-Visit:

1. loads the latest previous record
2. prefills the form
3. allows the Agent to update the information
4. creates a new Pre-Visit record
5. links the new record to the previous one through `previous_previsit_id`

## 10. Opening Superadmin Pre-Visits

When you open **Pre-Visits**, the app shows a chooser modal.

The modal offers:

- **View by Date**
- **View by Agent**

The Pre-Visit and Visit chooser modals use the same visual style.

### Change View

After entering one view, use **Change View** to return to the chooser and switch modes.

## 11. Pre-Visits — View by Agent

Choose **View by Agent** when you want to monitor workload or activity for a specific Agent.

The Agent monitor can filter Agents by Pre-Visit status, including operational categories such as:

- Ready for Visit
- Need Follow-up
- Direct Visit
- Rescheduled
- Stopped
- No Pre-Visit

Open an Agent to review their Pre-Visit activity by day and individual record.

## 12. Pre-Visits — View by Date

Choose **View by Date** when you need a daily operational table or report.

The date view uses Asia/Jakarta/WIB boundaries.

Route pattern:

```text
/superadmin/pre-visits/date?date=YYYY-MM-DD
```

The page displays all current fields from the live `pre_visits` table for the selected date.

Current fields include:

- `previsit_id`
- `customer_id`
- `agent_email`
- `contact_attempt_date`
- `phone_contacted`
- `still_wants_visit`
- `customer_available`
- `willing_to_reschedule`
- `rescheduled_contact_date`
- `address_confirmed`
- `confirmed_address`
- `landmark`
- `wants_appointment`
- `appointment_date`
- `address_visited`
- `address_visit_date`
- `visited_address_correct`
- `contact_result`
- `previsit_notes`
- `previsit_status`
- `created_at`
- `updated_at`
- `reschedule_date`
- `still_want_to_visit`
- `direct_visit`
- `address_correct_on_arrival`
- `stop_reason`
- `contact_confirmed`
- `appointment_confirmed`
- `supervisor_approval`
- `unpaid_reason`
- `previous_previsit_id`

## 13. Excel-style column filters

The date views for both Pre-Visits and Visits provide an Excel-style filter on every column.

Click the filter icon in a column header to open the filter menu.

You can:

- search values in that column
- select one value
- select multiple values
- combine filters across several columns
- clear one column filter
- clear all active filters

Example:

```text
agent_email
  ✓ agent-a@example.com
  ✓ agent-b@example.com

previsit_status
  ✓ Ready for Visit

phone_contacted
  ✓ FALSE
```

The table will only show rows matching all active filter conditions.

## 14. Generating a Pre-Visit report

On **Pre-Visits by Date**, click **Generate Report**.

The CSV report uses the current table state:

- if there are no column filters, all Pre-Visits for the selected date are exported
- if filters are active, only the currently filtered rows are exported

This allows Superadmin to create targeted reports such as:

- one Agent only
- one Pre-Visit status only
- direct visits only
- unable-to-contact cases only
- one customer ID

Open the generated CSV in Excel or another spreadsheet tool.

## 15. Visits overview

Visits are physical field Visit records and can contain:

- customer and Agent identity
- Visit date/time
- phone details
- Visit address
- GPS coordinates
- GPS accuracy
- GPS capture time
- Visit photo URL
- consent
- Visit result
- Visit summary
- distance to customer
- location match
- Visit status
- conversation result
- approved offer
- planned payment date
- unpaid reason
- additional notes

## 16. Opening Superadmin Visits

When you open **Visits**, the same style chooser modal appears with:

- **View by Date**
- **View by Agent**

Choose the view based on what you need to analyze.

## 17. Visits — View by Agent

Use **View by Agent** for Agent activity monitoring.

The monitor can highlight categories such as:

- all Agents
- met customer
- customer absent
- GPS mismatch
- no Visits

Open an Agent to drill into Visit dates and Visit details.

## 18. Visits — View by Date

Use **View by Date** for full daily Visit records.

Route pattern:

```text
/superadmin/visits/date?date=YYYY-MM-DD
```

The page uses the Jakarta/WIB calendar day and displays all current fields from the live `visits` table.

Current fields include:

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

## 19. Generating a Visit report

On **Visits by Date**, use the column filters if needed and click **Generate Report**.

The CSV export contains the currently filtered Visit rows.

Useful report examples include:

- one Agent's Visits for a date
- GPS mismatch only
- customer absent only
- one Visit result
- one conversation result
- customers with a planned payment date

## 20. Understanding payment status

Payment status is separate from Agent ownership.

Correct interpretation:

```text
payment_status = unpaid
→ Agent may remain attached

payment_status = paid
→ Agent also remains attached
```

Do not expect `agent_email` to become blank when payment changes to paid.

This is intentional and supports historical accountability and Agent fee calculations.

## 21. Reports

Use Reports for management reporting that is already implemented in the application.

For raw daily Visit or Pre-Visit exports, use the **By Date** screens because those surfaces expose all current Supabase fields and Excel-style filters.

## 22. Diagnostics

Use Diagnostics when an Agent reports a form or submission error.

Review fields such as:

- Agent email
- customer ID
- form type
- stage
- severity
- HTTP status
- error code
- error message
- details/hint
- page path
- online state
- metadata

This helps distinguish application, permission, network, attendance, and database errors.

## 23. Troubleshooting checklist

### Agent cannot access the app

Check:

1. the Agent email exists in `agents`
2. the email matches their Google account
3. `active = true`
4. role is correct

### Customer is unpaid but has no Agent

Check:

1. customer territory
2. whether the territory has an active Agent
3. whether assignment refresh has run
4. whether the customer was intentionally unassigned through territory configuration

Do not assume payment sync removed the Agent; unpaid status itself does not clear `agent_email`.

### Customer became paid and Agent disappeared

This should no longer occur under the current rules.

If encountered:

1. confirm the current database functions/migrations are deployed
2. check Visit and Pre-Visit history for the previous Agent
3. check territory ownership
4. avoid assigning a random Agent if the historical owner cannot be determined safely

### Pre-Visit chooser modal does not appear

The chooser should appear at the root Pre-Visits route unless Agent mode was explicitly selected with `mode=agent`.

Use **Change View** to return to the chooser.

### Pre-Visit duplicate submission warning

If the Agent is intentionally continuing a Pre-Visit, confirm that the new record contains the changed information. Rapid identical submissions may still be blocked as duplicate protection.

### Agent cannot submit field activity

Check Attendance and Diagnostics first.

### Date report appears to miss a record

Confirm:

1. selected date
2. Asia/Jakarta/WIB interpretation
3. active Excel-style filters
4. whether the record timestamp falls inside the selected WIB calendar day

## 24. Daily Superadmin review suggestion

A practical daily operating sequence is:

1. Review Attendance.
2. Review unassigned active customers and Territory ownership.
3. Open Pre-Visits → View by Date for today's preparation/contact activity.
4. Filter exceptions such as Need Follow-up, stopped, or direct Visit cases.
5. Open Visits → View by Date for today's field execution.
6. Filter GPS mismatch and unsuccessful Visit outcomes.
7. Review paid customers and `agent_fee_eligible` cases as needed.
8. Review Diagnostics for field-form errors.
9. Generate CSV reports after applying the required filters.

## 25. Data safety reminders

- Do not delete Customers, Pre-Visits, or Visits from the app.
- Do not manually clear Agent email simply because a customer is paid.
- Do not treat `assign_status` as stronger than `agent_email`.
- Do not treat `visit_status` as stronger than the Visits table.
- Preserve multiple Pre-Visit history.
- Use Supabase administrative access only for deliberate database corrections.
- Verify production changes before relying on them operationally.
