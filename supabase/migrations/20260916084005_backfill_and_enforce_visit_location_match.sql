create or replace function public.crl_haversine_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
strict
set search_path = public
as $$
  select 6371000.0 * 2.0 * asin(
    least(
      1.0,
      sqrt(
        power(sin(radians((lat2 - lat1) / 2.0)), 2)
        + cos(radians(lat1)) * cos(radians(lat2))
        * power(sin(radians((lon2 - lon1) / 2.0)), 2)
      )
    )
  );
$$;

create or replace function public.set_visit_location_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ref_lat double precision;
  ref_lon double precision;
begin
  select c.given_latitude, c.given_longitude
    into ref_lat, ref_lon
  from public.customers c
  where c.customer_id = new.customer_id;

  if new.latitude is not null
     and new.longitude is not null
     and ref_lat is not null
     and ref_lon is not null then
    new.distance_to_customer_meters := public.crl_haversine_meters(
      ref_lat, ref_lon, new.latitude, new.longitude
    );
    new.location_match := new.distance_to_customer_meters <= 200.0;
  else
    new.distance_to_customer_meters := null;
    new.location_match := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_visit_location_match on public.visits;
create trigger trg_set_visit_location_match
before insert or update of customer_id, latitude, longitude
on public.visits
for each row
execute function public.set_visit_location_match();

create or replace function public.refresh_visit_location_match_from_customer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.given_latitude is distinct from old.given_latitude
     or new.given_longitude is distinct from old.given_longitude then
    update public.visits v
    set
      distance_to_customer_meters = case
        when v.latitude is not null
         and v.longitude is not null
         and new.given_latitude is not null
         and new.given_longitude is not null
        then public.crl_haversine_meters(
          new.given_latitude, new.given_longitude, v.latitude, v.longitude
        )
        else null
      end,
      location_match = case
        when v.latitude is not null
         and v.longitude is not null
         and new.given_latitude is not null
         and new.given_longitude is not null
        then public.crl_haversine_meters(
          new.given_latitude, new.given_longitude, v.latitude, v.longitude
        ) <= 200.0
        else null
      end
    where v.customer_id = new.customer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_refresh_visit_location_match_from_customer on public.customers;
create trigger trg_refresh_visit_location_match_from_customer
after update of given_latitude, given_longitude
on public.customers
for each row
execute function public.refresh_visit_location_match_from_customer();

update public.visits v
set
  distance_to_customer_meters = public.crl_haversine_meters(
    c.given_latitude, c.given_longitude, v.latitude, v.longitude
  ),
  location_match = public.crl_haversine_meters(
    c.given_latitude, c.given_longitude, v.latitude, v.longitude
  ) <= 200.0
from public.customers c
where c.customer_id = v.customer_id
  and v.latitude is not null
  and v.longitude is not null
  and c.given_latitude is not null
  and c.given_longitude is not null;
