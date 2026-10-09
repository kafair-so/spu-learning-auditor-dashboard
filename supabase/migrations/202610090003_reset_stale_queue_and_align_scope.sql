-- The queue is opt-in: only courses explicitly selected by a reviewer may
-- remain queued.  Preserve history, but release old unclaimed jobs so they
-- do not block a later GR/GS/missing/failed selection.
update public.audit_jobs
set status = 'cancelled',
    last_error = 'queue_reset_before_explicit_selection',
    updated_at = now()
where status = 'queued';

-- Match scope selection to the report page by finding the most recent audit
-- run per course instead of relying on an optional cached pointer on courses.
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
         when latest_run.course_id is not null then 'refresh'::public.audit_job_kind
         else 'missing'::public.audit_job_kind end,
    case when scope_value in ('failed', 'retry') then 120 else 110 end
  from public.courses c
  left join lateral (
    select r.course_id, r.internal_status, r.source_payload
    from public.audit_runs r
    where r.course_id = c.course_id
    order by r.audited_at desc nulls last, r.created_at desc
    limit 1
  ) latest_run on true
  where c.active and c.catalog_version = p_catalog_version
    and not exists (
      select 1 from public.audit_jobs j
      where j.course_id = c.course_id and j.status in ('queued', 'running')
    )
    and (
      (scope_value = 'missing' and latest_run.course_id is null)
      or (scope_value in ('gr', 'gs') and lower(coalesce(c.course_group, '')) = scope_value)
      or (scope_value = 'failed' and latest_run.internal_status = 'audit_failed')
      or (scope_value = 'retry' and (
        latest_run.internal_status = 'audit_failed'
        or (latest_run.internal_status = 'needs_review'
            and coalesce(latest_run.source_payload ->> 'scoreModel', '') <> 'weekly_criterion_v2')
      ))
    )
  on conflict (job_key) do update
  set status = 'queued',
      kind = excluded.kind,
      priority = excluded.priority,
      attempts = 0,
      claimed_at = null,
      completed_at = null,
      last_error = null,
      updated_at = now()
  where public.audit_jobs.status in ('cancelled', 'failed');
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
