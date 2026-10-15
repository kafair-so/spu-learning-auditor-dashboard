alter table public.reviewer_emails
  drop constraint if exists reviewer_emails_role_check;

alter table public.reviewer_emails
  drop constraint if exists reviewer_email_role;

alter table public.reviewer_emails
  add constraint reviewer_emails_role_check
  check (role = any (array['owner'::text, 'super_admin'::text, 'admin'::text]));

update public.reviewer_emails
set role = 'owner', active = true, updated_at = now()
where email = 'siraprah.so@spu.ac.th';

create unique index if not exists reviewer_emails_single_owner_idx
  on public.reviewer_emails (role)
  where role = 'owner';

create or replace function public.transfer_reviewer_owner(
  p_from_email text,
  p_to_email text,
  p_display_name text default null
)
returns table(email text, display_name text, role text, active boolean, created_at timestamptz, created_by text, updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from text := lower(trim(p_from_email));
  v_to text := lower(trim(p_to_email));
  v_now timestamptz := now();
begin
  if v_from = '' or v_to = '' then
    raise exception 'owner_email_required';
  end if;

  if not exists (
    select 1 from public.reviewer_emails r
    where r.email = v_from and r.role = 'owner' and r.active = true
  ) then
    raise exception 'active_owner_required';
  end if;

  if v_from = v_to then
    update public.reviewer_emails r
    set display_name = nullif(trim(p_display_name), ''), updated_at = v_now
    where r.email = v_from;
  else
    update public.reviewer_emails r
    set role = 'super_admin', updated_at = v_now
    where r.email = v_from;

    insert into public.reviewer_emails as r
      (email, display_name, role, active, created_at, created_by, updated_at)
    values
      (v_to, nullif(trim(p_display_name), ''), 'owner', true, v_now, v_from, v_now)
    on conflict (email) do update
      set display_name = excluded.display_name,
          role = 'owner',
          active = true,
          updated_at = excluded.updated_at;
  end if;

  return query
  select r.email, r.display_name, r.role, r.active, r.created_at, r.created_by, r.updated_at
  from public.reviewer_emails r
  where r.email = v_to;
end;
$$;

revoke all on function public.transfer_reviewer_owner(text, text, text) from public, anon, authenticated;
grant execute on function public.transfer_reviewer_owner(text, text, text) to service_role;

