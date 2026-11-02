-- =====================================================================
-- club-tracker: hide advisors and super admins from leaderboard & directory
-- Run in Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

-- 1. Exclude advisors and super admins from the leaderboard
create or replace function public.leaderboard(p_days integer)
returns table (
  member_id     uuid,
  member_name   text,
  member_batch  text,
  score         bigint,
  prev_score    bigint,
  solved        bigint,
  contributions bigint,
  contests      bigint,
  active_days   bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today     date := (now() at time zone 'Asia/Dhaka')::date;
  v_cur_start date;
  v_prev_start date;
  v_solved    integer;
  v_contest   integer;
  v_contrib   integer;
  v_cap       integer;
  v_active    integer;
begin
  -- Only approved members/staff may call this
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'approved'
  ) then
    raise exception 'not allowed';
  end if;

  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'invalid period';
  end if;

  select st.points_per_solved, st.points_per_contest, st.points_per_contribution,
         st.contribution_daily_cap, st.points_per_active_day
    into v_solved, v_contest, v_contrib, v_cap, v_active
    from public.score_settings st
   limit 1;

  v_cur_start  := v_today - (p_days - 1);
  v_prev_start := v_cur_start - p_days;

  return query
  with eligible as (
    -- Only regular student members are eligible for the leaderboard
    select p.id as eid, p.full_name as ename, p.batch as ebatch
    from public.profiles p
    where p.status = 'approved'
      and p.show_on_leaderboard
      and p.role = 'member'
  ),
  daily as (
    -- one row per member per day; GitHub contributions are capped per day
    select a.profile_id as did,
           a.activity_date as dday,
           sum(a.solved)::integer as d_solved,
           least(sum(a.commits), v_cap)::integer as d_contrib
    from public.activity_daily a
    where a.activity_date between v_prev_start and v_today
    group by a.profile_id, a.activity_date
  ),
  cur as (
    select d.did as cid,
           sum(d.d_solved) as c_solved,
           sum(d.d_contrib) as c_contrib,
           count(*) filter (where d.d_solved + d.d_contrib > 0) as c_active
    from daily d
    where d.dday >= v_cur_start
    group by d.did
  ),
  prev as (
    select d.did as pid,
           sum(d.d_solved) as p_solved,
           sum(d.d_contrib) as p_contrib,
           count(*) filter (where d.d_solved + d.d_contrib > 0) as p_active
    from daily d
    where d.dday < v_cur_start
    group by d.did
  ),
  cc_cur as (
    select c.profile_id as ccid, count(*) as cc_n
    from public.contest_participation c
    where c.contest_date between v_cur_start and v_today
    group by c.profile_id
  ),
  cc_prev as (
    select c.profile_id as cpid, count(*) as cp_n
    from public.contest_participation c
    where c.contest_date >= v_prev_start and c.contest_date < v_cur_start
    group by c.profile_id
  )
  select e.eid,
         e.ename,
         e.ebatch,
         (coalesce(cur.c_solved, 0) * v_solved
          + coalesce(cur.c_contrib, 0) * v_contrib
          + coalesce(cc_cur.cc_n, 0) * v_contest
          + coalesce(cur.c_active, 0) * v_active)::bigint,
         (coalesce(prev.p_solved, 0) * v_solved
          + coalesce(prev.p_contrib, 0) * v_contrib
          + coalesce(cc_prev.cp_n, 0) * v_contest
          + coalesce(prev.p_active, 0) * v_active)::bigint,
         coalesce(cur.c_solved, 0)::bigint,
         coalesce(cur.c_contrib, 0)::bigint,
         coalesce(cc_cur.cc_n, 0)::bigint,
         coalesce(cur.c_active, 0)::bigint
  from eligible e
  left join cur     on cur.cid     = e.eid
  left join prev    on prev.pid    = e.eid
  left join cc_cur  on cc_cur.ccid = e.eid
  left join cc_prev on cc_prev.cpid = e.eid
  order by 4 desc, 2 asc;
end;
$$;

revoke execute on function public.leaderboard(integer) from public, anon;
grant  execute on function public.leaderboard(integer) to authenticated;


-- 2. Exclude advisors and super admins from the staff member overview (member directory)
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
    where p.role = 'member'
    order by p.created_at desc;
end;
$$;

revoke execute on function public.staff_member_overview() from public, anon;
grant  execute on function public.staff_member_overview() to authenticated;

