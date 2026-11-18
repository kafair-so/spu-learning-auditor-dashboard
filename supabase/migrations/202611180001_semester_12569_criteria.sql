alter table public.audit_jobs
  add column if not exists criteria_mode text not null default 'current',
  add column if not exists semester_code text not null default '';

alter table public.audit_runs
  add column if not exists criteria_mode text not null default 'current',
  add column if not exists semester_code text not null default '';

alter table public.audit_jobs drop constraint if exists audit_jobs_criteria_mode_check;
alter table public.audit_jobs add constraint audit_jobs_criteria_mode_check
  check (criteria_mode in ('current', 'legacy_12569'));
alter table public.audit_runs drop constraint if exists audit_runs_criteria_mode_check;
alter table public.audit_runs add constraint audit_runs_criteria_mode_check
  check (criteria_mode in ('current', 'legacy_12569'));

create index if not exists audit_jobs_criteria_semester_idx
  on public.audit_jobs (criteria_mode, semester_code, status);
create index if not exists audit_runs_course_criteria_idx
  on public.audit_runs (course_id, criteria_mode, semester_code, created_at desc);

create or replace function public.enqueue_selected_audits_v2(
  p_catalog_version text,
  p_scope text,
  p_criteria_mode text default 'current',
  p_semester_code text default ''
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  inserted_count integer;
  scope_value text := lower(trim(coalesce(p_scope, '')));
  criteria_value text := trim(coalesce(p_criteria_mode, 'current'));
  semester_value text := trim(coalesce(p_semester_code, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_audit_reviewer() then raise exception 'reviewer access required'; end if;
  if scope_value not in ('missing', 'gr', 'gs', 'all', 'failed', 'retry') then raise exception 'invalid_audit_scope'; end if;
  if criteria_value not in ('current', 'legacy_12569') then raise exception 'invalid_criteria_mode'; end if;
  if criteria_value = 'legacy_12569' and semester_value <> '1/2569' then raise exception 'invalid_semester_for_criteria'; end if;

  insert into public.audit_jobs(job_key, course_id, kind, priority, criteria_mode, semester_code)
  select
    'selected:' || criteria_value || ':' || semester_value || ':' || scope_value || ':' || c.course_id || ':' || p_catalog_version,
    c.course_id,
    case when scope_value in ('failed', 'retry') then 'retry'::public.audit_job_kind
         when latest_run.course_id is not null then 'refresh'::public.audit_job_kind
         else 'missing'::public.audit_job_kind end,
    case when scope_value in ('failed', 'retry') then 120 else 110 end,
    criteria_value,
    semester_value
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
      or (scope_value in ('gr', 'gs') and lower(trim(coalesce(c.course_group, ''))) = scope_value)
      or (scope_value = 'all' and lower(trim(coalesce(c.course_group, ''))) in ('gr', 'gs'))
      or (scope_value = 'failed' and latest_run.internal_status = 'audit_failed')
      or (scope_value = 'retry' and latest_run.internal_status in ('audit_failed', 'needs_review'))
    )
  on conflict (job_key) do update set
    status='queued',kind=excluded.kind,priority=excluded.priority,
    criteria_mode=excluded.criteria_mode,semester_code=excluded.semester_code,
    attempts=0,claimed_by=null,claimed_at=null,lease_expires_at=null,
    completed_at=null,last_error=null,updated_at=now()
  where public.audit_jobs.status in ('cancelled', 'failed', 'completed');

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.record_audit_result_v2(
  p_job_id uuid, p_external_audit_id text, p_internal_status public.audit_internal_status,
  p_score numeric, p_passing_score numeric, p_reviewable_points numeric,
  p_has_content boolean, p_audited_at timestamptz, p_auditor_version text,
  p_schema_version integer, p_evidence_summary jsonb, p_evidence_object_path text,
  p_evidence_sha256 text, p_source_payload jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target_job public.audit_jobs;
  new_run_id uuid;
  mapped_public public.audit_public_status;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service role required'; end if;
  select * into target_job from public.audit_jobs where job_id = p_job_id for update;
  if target_job.job_id is null then raise exception 'job not found'; end if;
  if target_job.status <> 'running' then raise exception 'job is not running'; end if;
  mapped_public := case p_internal_status
    when 'pass' then 'pass'::public.audit_public_status
    when 'has_content' then 'has_content'::public.audit_public_status
    when 'no_content' then 'no_content'::public.audit_public_status else null end;

  insert into public.audit_runs(
    external_audit_id,course_id,internal_status,public_status,score,passing_score,
    reviewable_points,has_content,audited_at,auditor_version,schema_version,
    evidence_summary,evidence_object_path,evidence_sha256,source_payload,created_by,
    criteria_mode,semester_code
  ) values (
    p_external_audit_id,target_job.course_id,p_internal_status,mapped_public,p_score,
    p_passing_score,coalesce(p_reviewable_points,0),p_has_content,p_audited_at,
    p_auditor_version,coalesce(p_schema_version,1),coalesce(p_evidence_summary,'{}'::jsonb),
    p_evidence_object_path,p_evidence_sha256,coalesce(p_source_payload,'{}'::jsonb),auth.uid(),
    target_job.criteria_mode,target_job.semester_code
  )
  on conflict (course_id,external_audit_id) do update set
    internal_status=excluded.internal_status,public_status=excluded.public_status,
    score=excluded.score,passing_score=excluded.passing_score,
    reviewable_points=excluded.reviewable_points,has_content=excluded.has_content,
    audited_at=excluded.audited_at,auditor_version=excluded.auditor_version,
    schema_version=excluded.schema_version,evidence_summary=excluded.evidence_summary,
    evidence_object_path=excluded.evidence_object_path,evidence_sha256=excluded.evidence_sha256,
    source_payload=excluded.source_payload,criteria_mode=excluded.criteria_mode,
    semester_code=excluded.semester_code
  returning run_id into new_run_id;

  update public.courses set latest_internal_run_id=new_run_id,latest_audited_at=p_audited_at,updated_at=now()
  where course_id=target_job.course_id;
  if mapped_public is not null then
    update public.courses set published_run_id=new_run_id,public_status=mapped_public,updated_at=now()
    where course_id=target_job.course_id;
    insert into public.public_course_results(
      course_id,course_code,course_title,course_group,faculty,instructor_names,course_url,
      status,score,audited_at,published_run_id,evidence_available,published_at
    )
    select c.course_id,c.course_code,c.course_title,c.course_group,c.faculty,c.instructor_names,
      c.course_url,mapped_public,p_score,p_audited_at,new_run_id,p_evidence_object_path is not null,now()
    from public.courses c where c.course_id=target_job.course_id
    on conflict (course_id) do update set
      course_code=excluded.course_code,course_title=excluded.course_title,
      course_group=excluded.course_group,faculty=excluded.faculty,
      instructor_names=excluded.instructor_names,course_url=excluded.course_url,
      status=excluded.status,score=excluded.score,audited_at=excluded.audited_at,
      published_run_id=excluded.published_run_id,evidence_available=excluded.evidence_available,
      published_at=excluded.published_at;
  end if;
  update public.audit_jobs set status='completed',completed_at=now(),lease_expires_at=null,updated_at=now()
  where job_id=p_job_id;
  if target_job.batch_id is not null then
    update public.refresh_batches b set
      completed_courses=(select count(*) from public.audit_jobs j where j.batch_id=b.batch_id and j.status='completed'),
      failed_courses=(select count(*) from public.audit_jobs j where j.batch_id=b.batch_id and j.status='failed'),
      status=case when not exists(select 1 from public.audit_jobs j where j.batch_id=b.batch_id and j.status in ('queued','running')) then 'completed' else 'running' end,
      completed_at=case when not exists(select 1 from public.audit_jobs j where j.batch_id=b.batch_id and j.status in ('queued','running')) then now() else null end
    where b.batch_id=target_job.batch_id;
  end if;
  return new_run_id;
end;
$$;
