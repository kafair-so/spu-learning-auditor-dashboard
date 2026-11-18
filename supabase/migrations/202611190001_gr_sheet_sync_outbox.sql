-- Durable, GR-only mirror queue. No change to audit scores or existing jobs.
create table public.gr_sheet_sync_outbox (
  course_id text primary key,
  run_id uuid not null,
  target_status text not null check (target_status in ('pass','has_content','no_content')),
  state text not null default 'pending' check (state in ('pending','verified','blocked','superseded')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error text,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.gr_sheet_sync_outbox enable row level security;
revoke all on public.gr_sheet_sync_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.gr_sheet_sync_outbox to service_role;

create function public.register_gr_sheet_sync(p_course_id text,p_run_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.courses; o public.gr_sheet_sync_outbox;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service role required'; end if;
  select * into c from public.courses where course_id=p_course_id and active and course_group='GR' for update;
  if c.course_id is null then raise exception 'active GR course required'; end if;
  if c.published_run_id is distinct from p_run_id or c.public_status is null then return null; end if;
  if c.public_status::text not in ('pass','has_content','no_content') then return null; end if;
  insert into public.gr_sheet_sync_outbox as q(course_id,run_id,target_status)
  values(c.course_id,p_run_id,c.public_status::text)
  on conflict(course_id) do update set run_id=excluded.run_id,target_status=excluded.target_status,
    state='pending',attempts=0,next_attempt_at=greatest(now(),coalesce(q.lease_until,now())),
    last_error=null,verified_at=null,updated_at=now()
  where q.run_id is distinct from excluded.run_id or q.target_status is distinct from excluded.target_status or q.state='superseded';
  select * into o from public.gr_sheet_sync_outbox where course_id=p_course_id;
  return to_jsonb(o);
end;$$;

create function public.claim_gr_sheet_sync(p_course_id text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.gr_sheet_sync_outbox;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service role required'; end if;
  select q.* into o from public.gr_sheet_sync_outbox q join public.courses c on c.course_id=q.course_id
  where c.active and c.course_group='GR' and c.published_run_id=q.run_id and c.public_status::text=q.target_status
    and q.state='pending' and q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<=now())
    and (p_course_id is null or q.course_id=p_course_id)
  order by q.next_attempt_at,q.course_id limit 1 for update of q skip locked;
  if o.course_id is null then return null; end if;
  update public.gr_sheet_sync_outbox set attempts=attempts+1,lease_token=gen_random_uuid(),
    lease_until=now()+interval '6 minutes',updated_at=now()
  where course_id=o.course_id returning * into o;
  return to_jsonb(o);
end;$$;

create function public.finish_gr_sheet_sync(p_course_id text,p_run_id uuid,p_target_status text,p_lease_token uuid,p_outcome text,p_error text,p_retry_seconds integer,p_hold_lease boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.gr_sheet_sync_outbox; still_current boolean;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service role required'; end if;
  if p_outcome not in ('verified','pending','blocked') then raise exception 'invalid sheet sync outcome'; end if;
  select * into o from public.gr_sheet_sync_outbox where course_id=p_course_id for update;
  if o.course_id is null or o.lease_token is distinct from p_lease_token or o.run_id is distinct from p_run_id or o.target_status is distinct from p_target_status then return null; end if;
  select exists(select 1 from public.courses c where c.course_id=p_course_id and c.active and c.course_group='GR' and c.published_run_id=p_run_id and c.public_status::text=p_target_status) into still_current;
  update public.gr_sheet_sync_outbox set
    state=case when not still_current then 'superseded' else p_outcome end,
    verified_at=case when still_current and p_outcome='verified' then now() else null end,
    last_error=case when p_outcome='verified' then null else left(coalesce(p_error,'sheet_sync_unconfirmed'),500) end,
    lease_token=null,
    lease_until=case when p_hold_lease then lease_until else null end,
    next_attempt_at=now()+make_interval(secs=>greatest(30,least(360,coalesce(p_retry_seconds,60)))),
    updated_at=now()
  where course_id=p_course_id returning * into o;
  return to_jsonb(o);
end;$$;

create function public.gr_sheet_sync_overview()
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object(
    'pending',count(*) filter(where q.state='pending'),
    'blocked',count(*) filter(where q.state='blocked'),
    'verified',count(*) filter(where q.state='verified'),
    'items',coalesce(jsonb_agg(jsonb_build_object('courseId',q.course_id,'courseCode',c.course_code,'state',q.state,'attempts',q.attempts,'error',q.last_error,'nextAttemptAt',greatest(q.next_attempt_at,coalesce(q.lease_until,q.next_attempt_at))) order by q.course_id) filter(where q.state in ('pending','blocked')),'[]'::jsonb)
  )
  from public.gr_sheet_sync_outbox q join public.courses c on c.course_id=q.course_id
  where auth.role()='service_role' and c.active and c.course_group='GR' and c.published_run_id=q.run_id and c.public_status::text=q.target_status;
$$;
revoke all on function public.register_gr_sheet_sync(text,uuid), public.claim_gr_sheet_sync(text), public.finish_gr_sheet_sync(text,uuid,text,uuid,text,text,integer,boolean), public.gr_sheet_sync_overview() from public,anon,authenticated;
grant execute on function public.register_gr_sheet_sync(text,uuid), public.claim_gr_sheet_sync(text), public.finish_gr_sheet_sync(text,uuid,text,uuid,text,text,integer,boolean), public.gr_sheet_sync_overview() to service_role;
