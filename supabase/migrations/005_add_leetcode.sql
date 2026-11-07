-- =====================================================================
-- club-tracker: Add LeetCode Platform Support
-- Run in Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- 1. Update check constraint on public.platform_accounts
alter table public.platform_accounts
  drop constraint if exists platform_accounts_platform_check;

alter table public.platform_accounts
  add constraint platform_accounts_platform_check
  check (platform in ('codeforces', 'codechef', 'vjudge',
                      'beecrowd', 'hackerrank', 'github', 'leetcode'));

-- 2. Update check constraint on public.activity_daily
alter table public.activity_daily
  drop constraint if exists activity_daily_platform_check;

alter table public.activity_daily
  add constraint activity_daily_platform_check
  check (platform in ('codeforces', 'codechef', 'vjudge',
                      'beecrowd', 'hackerrank', 'github', 'leetcode'));

-- 3. Update check constraint on public.contest_participation
alter table public.contest_participation
  drop constraint if exists contest_participation_platform_check;

alter table public.contest_participation
  add constraint contest_participation_platform_check
  check (platform in ('codeforces', 'codechef', 'vjudge',
                      'beecrowd', 'hackerrank', 'github', 'leetcode'));

-- 4. Update handle_new_user() to include leetcode_handle on signup
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
  user_role text;
begin
  -- Read role from signup metadata safely, default to member
  user_role := case when meta->>'role' = 'advisor' then 'advisor' else 'member' end;

  insert into public.profiles (
    id,
    full_name,
    email,
    student_id,
    batch,
    contact,
    designation,
    department,
    role,
    status,
    consent_at
  ) values (
    new.id,
    coalesce(nullif(trim(meta->>'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    case
      when user_role = 'advisor' then
        coalesce(nullif(trim(meta->>'student_id'), ''), 'adv-' || left(new.id::text, 8))
      else
        coalesce(nullif(trim(meta->>'student_id'), ''), 'unset-' || left(new.id::text, 8))
    end,
    case
      when user_role = 'advisor' then
        coalesce(trim(meta->>'department'), '')
      else
        coalesce(trim(meta->>'batch'), '')
    end,
    coalesce(trim(meta->>'contact'), ''),
    coalesce(trim(meta->>'designation'), ''),
    coalesce(trim(meta->>'department'), ''),
    user_role,
    'pending',
    case when meta->>'consent' = 'true' then now() end
  );

  -- Only create platform account handle records for members
  if user_role = 'member' then
    for pair in
      select * from (values
        ('codeforces', 'cf_handle'),
        ('codechef',   'codechef_handle'),
        ('vjudge',     'vjudge_handle'),
        ('beecrowd',   'beecrowd_handle'),
        ('hackerrank', 'hackerrank_handle'),
        ('github',     'github_username'),
        ('leetcode',   'leetcode_handle')
      ) as t (platform, meta_key)
    loop
      v := trim(meta->>pair.meta_key);
      if v is not null and v ~ '^[A-Za-z0-9._-]{1,64}$' then
        insert into public.platform_accounts (profile_id, platform, handle)
        values (new.id, pair.platform, v);
      end if;
    end loop;
  end if;

  return new;
end;
$$;
