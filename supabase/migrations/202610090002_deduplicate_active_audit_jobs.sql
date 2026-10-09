-- Keep at most one active queue item per course.  Historical jobs are
-- retained for auditability but no longer inflate the operational queue.
with ranked_active_jobs as (
  select job_id,
         row_number() over (
           partition by course_id
           order by case when status = 'running' then 0 else 1 end,
                    priority desc,
                    created_at desc
         ) as row_number
  from public.audit_jobs
  where status in ('queued', 'running')
)
update public.audit_jobs job
set status = 'cancelled',
    last_error = 'superseded_duplicate_queue',
    updated_at = now()
from ranked_active_jobs ranked
where job.job_id = ranked.job_id
  and ranked.row_number > 1;

create or replace function public.enqueue_missing_audits(p_catalog_version text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare inserted_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_audit_reviewer() then
    raise exception 'reviewer access required';
  end if;
  insert into public.audit_jobs(job_key, course_id, kind, priority)
  select 'missing:' || c.course_id || ':' || p_catalog_version,
         c.course_id, 'missing'::public.audit_job_kind, 100
  from public.courses c
  where c.active and c.catalog_version = p_catalog_version
    and not exists (select 1 from public.audit_runs r where r.course_id = c.course_id)
    and not exists (
      select 1 from public.audit_jobs j
      where j.course_id = c.course_id and j.status in ('queued', 'running')
    )
  on conflict (job_key) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.enqueue_selected_audits(p_catalog_version text, p_scope text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
  scope_value text := lower(trim(coalesce(p_scope, '')));
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_audit_reviewer() then
    raise exception 'reviewer access required';
  end if;
  if scope_value not in ('missing', 'gr', 'gs', 'failed', 'retry') then
    raise exception 'invalid_audit_scope';
  end if;
  insert into public.audit_jobs(job_key, course_id, kind, priority)
  select
    'selected:' || scope_value || ':' || c.course_id || ':' || p_catalog_version,
    c.course_id,
    case when scope_value in ('failed', 'retry') then 'retry'::public.audit_job_kind
         when exists (select 1 from public.audit_runs r where r.course_id = c.course_id) then 'refresh'::public.audit_job_kind
         else 'missing'::public.audit_job_kind end,
    case when scope_value in ('failed', 'retry') then 120 else 110 end
  from public.courses c
  left join public.audit_runs latest_run on latest_run.run_id = c.latest_internal_run_id
  where c.active and c.catalog_version = p_catalog_version
    and not exists (
      select 1 from public.audit_jobs j
      where j.course_id = c.course_id and j.status in ('queued', 'running')
    )
    and (
      (scope_value = 'missing' and not exists (select 1 from public.audit_runs r where r.course_id = c.course_id))
      or (scope_value in ('gr', 'gs') and lower(coalesce(c.course_group, '')) = scope_value)
      or (scope_value = 'failed' and latest_run.internal_status = 'audit_failed')
      or (scope_value = 'retry' and (
        latest_run.internal_status = 'audit_failed'
        or (latest_run.internal_status = 'needs_review' and coalesce(latest_run.source_payload ->> 'scoreModel', '') <> 'weekly_criterion_v2')
      ))
    )
  on conflict (job_key) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.enqueue_refresh_audits()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_batch uuid := gen_random_uuid();
  inserted_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_audit_reviewer() then
    raise exception 'reviewer access required';
  end if;
  insert into public.refresh_batches(batch_id, requested_by, status)
  values (new_batch, auth.uid(), 'queued');
  insert into public.audit_jobs(job_key, course_id, kind, priority, batch_id)
  select 'refresh:' || new_batch::text || ':' || c.course_id,
         c.course_id, 'refresh'::public.audit_job_kind, 10, new_batch
  from public.courses c
  where c.active
    and exists (select 1 from public.audit_runs r where r.course_id = c.course_id)
    and not exists (
      select 1 from public.audit_jobs j
      where j.course_id = c.course_id and j.status in ('queued', 'running')
    );
  get diagnostics inserted_count = row_count;
  update public.refresh_batches
  set total_courses = inserted_count,
      status = case when inserted_count = 0 then 'completed' else 'queued' end,
      completed_at = case when inserted_count = 0 then now() else null end
  where batch_id = new_batch;
  return new_batch;
end;
$$;
