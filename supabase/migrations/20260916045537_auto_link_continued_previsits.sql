-- Automatically link a newly continued Pre-Visit to the latest prior record.

create or replace function public.link_previous_previsit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.previous_previsit_id is null then
    select p.previsit_id
      into new.previous_previsit_id
    from public.pre_visits p
    where p.customer_id = new.customer_id
    order by p.created_at desc, p.previsit_id desc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_link_previous_previsit on public.pre_visits;
create trigger trg_link_previous_previsit
before insert on public.pre_visits
for each row execute function public.link_previous_previsit();
