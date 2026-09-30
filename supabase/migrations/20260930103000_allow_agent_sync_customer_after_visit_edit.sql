create or replace function public.sync_assigned_customer_after_visit_edit(
  p_customer_id text,
  p_payment_status text,
  p_phone_number text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(public.current_email());
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.customer_id = p_customer_id
      and lower(c.agent_email) = v_email
  ) then
    raise exception 'Customer is not assigned to current agent';
  end if;

  update public.customers
  set
    visit_status = 'Visited',
    customer_status = '5. Visited',
    payment_status = case
      when lower(coalesce(p_payment_status, '')) = 'paid' then 'paid'
      else 'unpaid'
    end,
    phone_number = case
      when nullif(trim(coalesce(p_phone_number, '')), '') is not null then trim(p_phone_number)
      else phone_number
    end
  where customer_id = p_customer_id;
end;
$$;

revoke all on function public.sync_assigned_customer_after_visit_edit(text, text, text) from public;
grant execute on function public.sync_assigned_customer_after_visit_edit(text, text, text) to authenticated;
