-- Dashboard release hardening for the 0.13.28 rollout.
-- Keep privileged queue mutations behind the Edge Function service role,
-- remove unnecessary public execution grants, and address advisor findings.

alter function public.is_spu_user() security invoker;
alter function public.is_audit_reviewer() security invoker;

revoke execute on function public.is_spu_user() from anon;
grant execute on function public.is_spu_user() to authenticated;

revoke all on function public.retain_public_run_and_queue_evidence() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

revoke execute on function public.enqueue_missing_audits(text) from authenticated;
revoke execute on function public.enqueue_refresh_audits() from authenticated;
grant execute on function public.enqueue_missing_audits(text) to service_role;
grant execute on function public.enqueue_refresh_audits() to service_role;

create index if not exists audit_jobs_batch_id_idx
  on public.audit_jobs (batch_id);

create index if not exists courses_latest_internal_run_id_idx
  on public.courses (latest_internal_run_id);

create index if not exists courses_published_run_id_idx
  on public.courses (published_run_id);

create index if not exists review_decisions_reviewer_id_idx
  on public.review_decisions (reviewer_id);

create index if not exists review_decisions_run_id_idx
  on public.review_decisions (run_id);

drop policy if exists reviewer_self_read on public.reviewers;
create policy reviewer_self_read
  on public.reviewers
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists reviewer_decisions_insert on public.review_decisions;
create policy reviewer_decisions_insert
  on public.review_decisions
  for insert
  to authenticated
  with check (
    public.is_audit_reviewer()
    and reviewer_id = (select auth.uid())
  );

