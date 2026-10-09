-- A stable catalog fingerprint is intentional.  Permit a reviewer to
-- explicitly reuse a cancelled/failed "missing" job key without creating a
-- second active job for the same course.
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
