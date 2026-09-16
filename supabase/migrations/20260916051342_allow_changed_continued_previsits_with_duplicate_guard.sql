-- Keep duplicate-submit protection, but allow an intentional continued Pre-Visit
-- when the Agent changes any business field from the recent prior submission.

create or replace function public.prevent_duplicate_previsit_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(new.agent_email) || ':' || new.customer_id, 0));

  if exists (
    select 1
    from public.pre_visits p
    where p.customer_id = new.customer_id
      and lower(p.agent_email) = lower(new.agent_email)
      and p.created_at >= now() - interval '30 seconds'
      and (
        to_jsonb(p) - array['previsit_id','created_at','updated_at','contact_attempt_date','previous_previsit_id']
      ) = (
        to_jsonb(new) - array['previsit_id','created_at','updated_at','contact_attempt_date','previous_previsit_id']
      )
  ) then
    raise exception 'Pre-Visit already submitted. Please wait before submitting again.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;
