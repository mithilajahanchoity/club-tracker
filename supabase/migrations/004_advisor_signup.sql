-- =====================================================================
-- club-tracker: advisor signup support (run in Supabase SQL Editor)
-- Adds designation and department to profiles, and updates signup trigger
-- =====================================================================

-- 1. Add designation and department columns to profiles table
alter table public.profiles
  add column if not exists designation text not null default '',
  add column if not exists department  text not null default '';

-- 2. Grant column updates to authenticated users
grant update (designation, department) on public.profiles to authenticated;

-- 3. Update handle_new_user() to support both member and advisor signups
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
        ('github',     'github_username')
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
