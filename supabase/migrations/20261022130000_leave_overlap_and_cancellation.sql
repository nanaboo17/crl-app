-- Serialize leave submissions per agent and enforce no overlapping active ranges.
create extension if not exists btree_gist;
alter table public.agent_leave_requests
 add constraint crl_leave_no_active_overlap exclude using gist (
 (lower(agent_email)) with =,
 daterange(start_date,end_date,'[]') with &&
 ) where (status in ('pending','approved'));

create or replace function public.crl_submit_leave_request(
 p_type text,p_start_date date,p_end_date date,p_reason text,p_evidence_path text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_email text := lower(auth.jwt()->>'email'); v_lead text; v_id uuid;
begin
 if v_email is null or v_email='' then raise exception 'Authentication required'; end if;
 select lower(nullif(btrim(a.lead_email),'')) into v_lead from public.agents a where lower(a.email)=v_email and a.role='agent' and a.active=true;
 if v_lead is null then raise exception 'Assigned Lead is missing; contact Superadmin'; end if;
 if p_type not in ('sick','permission') then raise exception 'Invalid request type'; end if;
 if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date > p_start_date+30 then raise exception 'Invalid date range (max 31 days)'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'Reason must contain 5–1000 characters'; end if;
 if p_type='sick' and nullif(btrim(coalesce(p_evidence_path,'')),'') is null then raise exception 'Medical evidence is required'; end if;
 if p_evidence_path is not null and p_evidence_path <> '' and p_evidence_path not like v_email||'/%' then raise exception 'Invalid evidence path'; end if;
 if exists(select 1 from public.agent_leave_requests r where lower(r.agent_email)=v_email and r.status in ('pending','approved') and r.start_date<=p_end_date and r.end_date>=p_start_date) then raise exception 'Overlapping request exists. Cancel the existing request first.'; end if;
 insert into public.agent_leave_requests(agent_email,lead_email,request_type,start_date,end_date,reason,evidence_path)
 values(v_email,v_lead,p_type,p_start_date,p_end_date,btrim(p_reason),nullif(p_evidence_path,'')) returning id into v_id;
 insert into public.agent_leave_request_events(request_id,actor_email,event_type) values(v_id,v_email,'submitted');
 return v_id;
end $$;

create or replace function public.crl_review_leave_request(p_request_id uuid,p_decision text,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.agent_leave_requests%rowtype; v_email text := lower(auth.jwt()->>'email');
begin
 if v_email is null or v_email='' then raise exception 'Authentication required'; end if;
 select * into r from public.agent_leave_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if p_decision not in ('approved','rejected','cancelled') then raise exception 'Invalid decision'; end if;
 if p_decision='cancelled' then
   if r.status not in ('pending','approved') then raise exception 'Only pending or approved requests may be cancelled'; end if;
   if v_email<>lower(r.agent_email) and not public.crl_leave_is_superadmin() then raise exception 'Not authorized to cancel'; end if;
   -- Date comparisons use Jakarta day; cannot cancel on start date or any later date.
   if (now() at time zone 'Asia/Jakarta')::date >= r.start_date then raise exception 'Cancellation deadline passed; only possible before the first leave date'; end if;
 else
   if r.status<>'pending' then raise exception 'Request has already been processed'; end if;
   if not public.crl_leave_is_superadmin() and not (v_email=lower(r.lead_email) and exists (
     select 1 from public.agents a where lower(a.email)=lower(r.agent_email) and lower(a.lead_email)=v_email and a.active=true
   )) then raise exception 'Not authorized to approve this agent'; end if;
 end if;
 if p_decision='rejected' and length(btrim(coalesce(p_reason,'')))<5 then raise exception 'Rejection reason is required'; end if;
 update public.agent_leave_requests set status=p_decision,reviewed_by=v_email,reviewed_at=now(),rejection_reason=case when p_decision='rejected' then p_reason else null end,updated_at=now() where id=p_request_id;
 insert into public.agent_leave_request_events(request_id,actor_email,event_type,note) values(p_request_id,v_email,p_decision,p_reason);
end $$;
revoke all on function public.crl_submit_leave_request(text,date,date,text,text),public.crl_review_leave_request(uuid,text,text) from public,anon;
grant execute on function public.crl_submit_leave_request(text,date,date,text,text),public.crl_review_leave_request(uuid,text,text) to authenticated;
