-- One page + exact summary under the caller's own RLS, without the 1,000-row API cap.
create or replace function public.crl_agent_history_page_v1(p_kind text, p_page integer default 1, p_search text default '')
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  v_email text := lower(nullif(auth.jwt()->>'email',''));
  v_page int := greatest(1,least(coalesce(p_page,1),100000));
  v_query text := left(trim(coalesce(p_search,'')),120);
  v_result jsonb;
begin
  if v_email is null or not exists (select 1 from public.agents a where lower(a.email)=v_email and a.active=true and a.role='agent') then
    raise exception 'Agent authentication required' using errcode='42501';
  end if;
  if p_kind='visits' then
    with scoped as (
      select v.* from public.visits v where lower(v.agent_email)=v_email
    ), totals as (
      select count(*) total, count(*) filter(where nullif(trim(visit_result),'') is not null) completed,
             count(distinct (visit_date at time zone 'Asia/Jakarta')::date) days
      from scoped
    ), matched as (
      select * from scoped where v_query='' or
        coalesce(customer_id,'') ilike '%'||v_query||'%' or coalesce(crl_id,'') ilike '%'||v_query||'%' or
        coalesce(visit_id,'') ilike '%'||v_query||'%' or coalesce(visit_address,'') ilike '%'||v_query||'%' or
        coalesce(visit_summary,'') ilike '%'||v_query||'%' or coalesce(visit_result,'') ilike '%'||v_query||'%'
    ), matching as (select count(*) filtered from matched),
    paged as (select * from matched order by visit_date desc nulls last, visit_id desc limit 5 offset (v_page-1)*5)
    select jsonb_build_object('total',t.total,'completed',t.completed,'recentDays',t.days,'filteredTotal',m.filtered,
      'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.visit_date desc nulls last,p.visit_id desc) from paged p),'[]'::jsonb))
      into v_result from totals t cross join matching m;
  elsif p_kind='pre_visits' then
    with scoped as (select p.* from public.pre_visits p where lower(p.agent_email)=v_email),
    ranked as (select p.*, row_number() over (partition by coalesce(nullif(crl_id,''),nullif(customer_id,''),previsit_id)
      order by created_at desc nulls last,previsit_id desc) rn from scoped p),
    latest as (select * from ranked where rn=1),
    totals as (select count(*) total,count(*) filter(where previsit_status='Ready for Visit') ready,
      count(*) filter(where previsit_status='Need Follow-up') followup from latest),
    matched as (select * from latest where v_query='' or coalesce(customer_id,'') ilike '%'||v_query||'%' or
      coalesce(crl_id,'') ilike '%'||v_query||'%' or coalesce(previsit_id,'') ilike '%'||v_query||'%' or
      coalesce(previsit_status,'') ilike '%'||v_query||'%'),
    matching as (select count(*) filtered from matched),
    paged as (select * from matched order by created_at desc nulls last,previsit_id desc limit 5 offset (v_page-1)*5)
    select jsonb_build_object('total',t.total,'ready',t.ready,'followup',t.followup,'filteredTotal',m.filtered,
      'rows',coalesce((select jsonb_agg(to_jsonb(p)-'rn' order by p.created_at desc nulls last,p.previsit_id desc) from paged p),'[]'::jsonb))
      into v_result from totals t cross join matching m;
  else
    raise exception 'Unsupported history type' using errcode='22023';
  end if;
  return v_result;
end $$;
revoke all on function public.crl_agent_history_page_v1(text,integer,text) from public,anon;
grant execute on function public.crl_agent_history_page_v1(text,integer,text) to authenticated;
