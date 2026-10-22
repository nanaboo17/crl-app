-- CRL sick/permission requests; deploy before enabling UI.
create table if not exists public.agent_leave_requests (
 id uuid primary key default gen_random_uuid(),
 agent_email text not null,
 lead_email text not null,
 request_type text not null check (request_type in ('sick','permission')),
 start_date date not null,
 end_date date not null,
 reason text not null check (char_length(btrim(reason)) between 5 and 1000),
 evidence_path text,
 status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
 reviewed_by text,
 reviewed_at timestamptz,
 rejection_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint agent_leave_date_order check (end_date >= start_date),
 constraint agent_leave_max_duration check (end_date <= start_date + 30),
 constraint agent_leave_sick_evidence check (request_type <> 'sick' or evidence_path is not null)
);
create index if not exists agent_leave_requests_agent_dates_idx on public.agent_leave_requests (lower(agent_email),start_date,end_date);
create index if not exists agent_leave_requests_lead_status_idx on public.agent_leave_requests (lower(lead_email),status);
create table if not exists public.agent_leave_request_events (
 id bigint generated always as identity primary key,
 request_id uuid not null references public.agent_leave_requests(id),
 actor_email text not null,
 event_type text not null check(event_type in ('submitted','approved','rejected','cancelled')),
 note text,
 created_at timestamptz not null default now()
);
alter table public.agent_leave_requests enable row level security;
alter table public.agent_leave_request_events enable row level security;
revoke all on public.agent_leave_requests,public.agent_leave_request_events from anon,authenticated;
grant select on public.agent_leave_requests,public.agent_leave_request_events to authenticated;
create or replace function public.crl_leave_is_superadmin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.agents a where lower(a.email)=lower(auth.jwt()->>'email') and a.role='superadmin' and a.active=true)
$$;
revoke all on function public.crl_leave_is_superadmin() from public,anon;
grant execute on function public.crl_leave_is_superadmin() to authenticated;
create policy "leave_select_authorized" on public.agent_leave_requests for select to authenticated using (
 lower(agent_email)=lower(auth.jwt()->>'email')
 or public.crl_leave_is_superadmin()
 or (lower(lead_email)=lower(auth.jwt()->>'email') and exists (
 select 1 from public.agents a where lower(a.email)=lower(agent_email) and lower(a.lead_email)=lower(auth.jwt()->>'email') and a.active=true))
);
create policy "leave_events_read" on public.agent_leave_request_events for select to authenticated using (
 exists(select 1 from public.agent_leave_requests r where r.id=request_id)
);
-- RPCs are SECURITY DEFINER. No direct write permission is granted to the client.
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
 if exists(select 1 from public.agent_leave_requests r where lower(r.agent_email)=v_email and r.status in ('pending','approved') and r.start_date<=p_end_date and r.end_date>=p_start_date) then raise exception 'Overlapping request exists'; end if;
 insert into public.agent_leave_requests(agent_email,lead_email,request_type,start_date,end_date,reason,evidence_path)
 values(v_email,v_lead,p_type,p_start_date,p_end_date,btrim(p_reason),nullif(p_evidence_path,'')) returning id into v_id;
 insert into public.agent_leave_request_events(request_id,actor_email,event_type) values(v_id,v_email,'submitted');
 return v_id;
end $$;
create or replace function public.crl_review_leave_request(p_request_id uuid,p_decision text,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.agent_leave_requests%rowtype; v_email text := lower(auth.jwt()->>'email');
begin
 select * into r from public.agent_leave_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found'; end if;
 if r.status<>'pending' then raise exception 'Request has already been processed'; end if;
 if p_decision not in ('approved','rejected','cancelled') then raise exception 'Invalid decision'; end if;
 if p_decision='cancelled' then
   if v_email<>lower(r.agent_email) and not public.crl_leave_is_superadmin() then raise exception 'Not authorized to cancel'; end if;
 else
   if not public.crl_leave_is_superadmin() and not (v_email=lower(r.lead_email) and exists (
     select 1 from public.agents a where lower(a.email)=lower(r.agent_email) and lower(a.lead_email)=v_email and a.active=true
   )) then raise exception 'Not authorized to approve this agent'; end if;
 end if;
 if p_decision='rejected' and length(btrim(coalesce(p_reason,'')))<5 then raise exception 'Rejection reason is required'; end if;
 update public.agent_leave_requests set status=p_decision, reviewed_by=v_email,reviewed_at=now(),
 rejection_reason=case when p_decision='rejected' then p_reason else null end, updated_at=now()
 where id=p_request_id;
 insert into public.agent_leave_request_events(request_id,actor_email,event_type,note)
 values(p_request_id,v_email,p_decision,p_reason);
end $$;
revoke all on function public.crl_submit_leave_request(text,date,date,text,text), public.crl_review_leave_request(uuid,text,text) from public,anon;
grant execute on function public.crl_submit_leave_request(text,date,date,text,text), public.crl_review_leave_request(uuid,text,text) to authenticated;
-- Evidence bucket is private; each agent may upload to their own email prefix.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('leave-evidence','leave-evidence',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
create policy "leave_evidence_agent_upload" on storage.objects for insert to authenticated with check (
 bucket_id='leave-evidence' and (storage.foldername(name))[1]=lower(auth.jwt()->>'email')
 and exists(select 1 from public.agents a where lower(a.email)=lower(auth.jwt()->>'email') and a.role='agent' and a.active=true)
);
create policy "leave_evidence_scoped_read" on storage.objects for select to authenticated using (
 bucket_id='leave-evidence' and (
 (storage.foldername(name))[1]=lower(auth.jwt()->>'email')
 or public.crl_leave_is_superadmin()
 or exists(select 1 from public.agent_leave_requests r where r.evidence_path=name and r.status in ('pending','approved','rejected') and lower(r.lead_email)=lower(auth.jwt()->>'email') and exists (
 select 1 from public.agents a where lower(a.email)=lower(r.agent_email) and lower(a.lead_email)=lower(auth.jwt()->>'email') and a.active=true))
 )
);
