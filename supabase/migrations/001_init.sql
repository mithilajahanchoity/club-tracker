-- =====================================================================
-- club-tracker: initial schema, security (RLS + grants), signup trigger
-- Run ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Also save this file as supabase/migrations/001_init.sql in the repo.
--
-- Model:
--   members     -> read/edit only their own safe fields
--   advisors    -> read-only on everything (approved advisors only)
--   super_admin -> manages data through server routes using the
--                  service_role key (never from the browser)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null,
  student_id  text not null unique,
  batch       text not null default '',
  contact     text not null default '',
  role        text not null default 'member'
              check (role in ('member', 'advisor', 'super_admin')),
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected', 'suspended')),
  consent_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_batch_idx  on public.profiles (batch);
create index profiles_status_idx on public.profiles (status);

create table public.platform_accounts (
  id              bigint generated always as identity primary key,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  platform        text not null
                  check (platform in ('codeforces', 'codechef', 'vjudge',
                                      'beecrowd', 'hackerrank', 'github')),
  handle          text not null check (handle ~ '^[A-Za-z0-9._-]{1,64}$'),
  verified        boolean not null default false,
  last_synced_at  timestamptz,
  unique (profile_id, platform)
);

create index platform_accounts_handle_idx on public.platform_accounts (handle);

create table public.activity_daily (
  id             bigint generated always as identity primary key,
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  platform       text not null
                 check (platform in ('codeforces', 'codechef', 'vjudge',
                                     'beecrowd', 'hackerrank', 'github')),
  activity_date  date not null,
  solved         integer not null default 0,
  commits        integer not null default 0,
  rating         integer,
  unique (profile_id, platform, activity_date)
);

create index activity_daily_date_idx on public.activity_daily (activity_date);

create table public.contest_participation (
  id             bigint generated always as identity primary key,
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  platform       text not null
                 check (platform in ('codeforces', 'codechef', 'vjudge',
                                     'beecrowd', 'hackerrank', 'github')),
  contest_name   text not null,
  contest_date   date not null,
  rank           integer,
  rating_change  integer,
  unique (profile_id, platform, contest_name, contest_date)
);

create index contest_participation_date_idx
  on public.contest_participation (contest_date);

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS
-- SECURITY DEFINER lets policies check the caller's role WITHOUT
-- triggering "infinite recursion" on the profiles table.
-- ---------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('advisor', 'super_admin')
      and status = 'approved'
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'super_admin'
      and status = 'approved'
  );
$$;

revoke execute on function public.is_staff()       from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
grant  execute on function public.is_staff()       to authenticated;
grant  execute on function public.is_super_admin() to authenticated;


-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------

-- 3a. Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3b. Changing a handle clears "verified" (nobody can keep a verified
--     badge after switching to someone else's username)
create or replace function public.reset_verification_on_handle_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.handle is distinct from old.handle then
    new.verified := false;
    new.last_synced_at := null;
  end if;
  return new;
end;
$$;

create trigger platform_accounts_reset_verification
  before update of handle on public.platform_accounts
  for each row execute function public.reset_verification_on_handle_change();

-- 3c. On signup: create the profile + handle rows from signup metadata.
--     SECURITY: role and status are NEVER read from metadata, because
--     users control that data. Everyone starts as member / pending.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  pair record;
  v    text;
begin
  insert into public.profiles
    (id, full_name, email, student_id, batch, contact, consent_at)
  values (
    new.id,
    coalesce(nullif(trim(meta->>'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    coalesce(nullif(trim(meta->>'student_id'), ''), 'unset-' || left(new.id::text, 8)),
    coalesce(trim(meta->>'batch'), ''),
    coalesce(trim(meta->>'contact'), ''),
    case when meta->>'consent' = 'true' then now() end
  );

  for pair in
    select * from (values
      ('codeforces', 'cf_handle'),
      ('codechef',   'codechef_handle'),
      ('vjudge',     'vjudge_handle'),
      ('beecrowd',   'beecrowd_handle'),
      ('hackerrank', 'hackerrank_handle'),
      ('github',     'github_username')
    ) as t (platform, meta_key)
  loop
    v := trim(meta->>pair.meta_key);
    if v is not null and v ~ '^[A-Za-z0-9._-]{1,64}$' then
      insert into public.platform_accounts (profile_id, platform, handle)
      values (new.id, pair.platform, v);
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.platform_accounts     enable row level security;
alter table public.activity_daily        enable row level security;
alter table public.contest_participation enable row level security;
alter table public.audit_logs            enable row level security;

-- profiles: read own row, or everything if approved staff
create policy "profiles: read own or staff"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());

-- profiles: update own row only (column grants below limit WHICH columns)
create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- platform_accounts: read own or staff; write own only
create policy "platform_accounts: read own or staff"
  on public.platform_accounts for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_staff());

create policy "platform_accounts: insert own"
  on public.platform_accounts for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy "platform_accounts: update own"
  on public.platform_accounts for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "platform_accounts: delete own"
  on public.platform_accounts for delete to authenticated
  using (profile_id = (select auth.uid()));

-- activity + contests: read own or staff; written only by sync scripts
create policy "activity_daily: read own or staff"
  on public.activity_daily for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_staff());

create policy "contest_participation: read own or staff"
  on public.contest_participation for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_staff());

-- audit_logs: only super admins can read; written by server code only
create policy "audit_logs: super admin read"
  on public.audit_logs for select to authenticated
  using (public.is_super_admin());


-- ---------------------------------------------------------------------
-- 5. GRANTS (API access is OFF by default for new tables)
-- Column-level grants are what stop members from editing their own
-- role / status / verified fields.
-- ---------------------------------------------------------------------

revoke all on public.profiles              from anon, authenticated;
revoke all on public.platform_accounts     from anon, authenticated;
revoke all on public.activity_daily        from anon, authenticated;
revoke all on public.contest_participation from anon, authenticated;
revoke all on public.audit_logs            from anon, authenticated;

-- profiles
grant select                          on public.profiles to authenticated;
grant update (full_name, batch, contact) on public.profiles to authenticated;

-- platform_accounts (members can add/change/remove handles, not verified)
grant select, delete                          on public.platform_accounts to authenticated;
grant insert (profile_id, platform, handle)   on public.platform_accounts to authenticated;
grant update (handle)                         on public.platform_accounts to authenticated;

-- read-only tables
grant select on public.activity_daily        to authenticated;
grant select on public.contest_participation to authenticated;
grant select on public.audit_logs            to authenticated;

-- server-side key (sync scripts + admin routes)
grant all on public.profiles              to service_role;
grant all on public.platform_accounts     to service_role;
grant all on public.activity_daily        to service_role;
grant all on public.contest_participation to service_role;
grant all on public.audit_logs            to service_role;


-- ---------------------------------------------------------------------
-- 6. STAFF OVERVIEW (member list + last login)
-- Last login lives in auth.users, which the browser cannot read, so
-- approved staff get it through this checked function.
-- ---------------------------------------------------------------------

create or replace function public.staff_member_overview()
returns table (
  id              uuid,
  full_name       text,
  email           text,
  student_id      text,
  batch           text,
  role            text,
  status          text,
  last_sign_in_at timestamptz,
  created_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'not allowed';
  end if;

  return query
    select p.id, p.full_name, p.email, p.student_id, p.batch,
           p.role, p.status, u.last_sign_in_at, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke execute on function public.staff_member_overview() from public, anon;
grant  execute on function public.staff_member_overview() to authenticated;


-- ---------------------------------------------------------------------
-- 7. MAKE YOUR FIRST SUPER ADMIN  (run AFTER the user exists)
-- Uncomment, check the email, and run it as a separate query:
-- ---------------------------------------------------------------------
-- update public.profiles
--    set role = 'super_admin', status = 'approved'
--  where email = 'mithilajahan559@gmail.com';
