alter table public.field_form_diagnostic_logs
  drop constraint if exists field_form_diagnostic_logs_form_type_check;

alter table public.field_form_diagnostic_logs
  add constraint field_form_diagnostic_logs_form_type_check
  check (form_type in ('previsit','visit','attendance','unknown'));
