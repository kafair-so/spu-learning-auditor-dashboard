-- Queue only the group or remediation set chosen by an authorized reviewer.
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
    case
      when scope_value in ('failed', 'retry') then 'retry'::public.audit_job_kind
      when exists (select 1 from public.audit_runs existing_run where existing_run.course_id = c.course_id)
        then 'refresh'::public.audit_job_kind
      else 'missing'::public.audit_job_kind
    end,
    case when scope_value in ('failed', 'retry') then 120 else 110 end
  from public.courses c
  left join public.audit_runs latest_run on latest_run.run_id = c.latest_internal_run_id
  where c.active
    and c.catalog_version = p_catalog_version
    and (
      (scope_value = 'missing' and not exists (select 1 from public.audit_runs no_run where no_run.course_id = c.course_id))
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
