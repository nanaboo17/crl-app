create or replace function public.update_customer_geocode(
  p_customer_id text,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid coordinates';
  end if;

  update public.customers
  set given_latitude = p_latitude,
      given_longitude = p_longitude
  where customer_id = p_customer_id
    and (
      public.current_role() in ('admin','superadmin')
      or (
        lower(agent_email) = lower(public.current_email())
        and assignment_date = current_date
      )
    );

  if not found then
    raise exception 'Customer not found or not authorized';
  end if;
end;
$$;

grant execute on function public.update_customer_geocode(text,double precision,double precision) to authenticated;
