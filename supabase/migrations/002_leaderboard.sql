-- =====================================================================
-- club-tracker: leaderboard (run AFTER 001_init.sql)
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Members cannot read each other's raw activity (RLS blocks it), so the
-- leaderboard is computed by a checked function that returns ONLY:
-- name, batch and aggregate numbers, for approved members who have not
-- opted out. Never emails, student IDs or phone numbers.
-- =====================================================================


-- 1. Opt-out flag (members can change their own, nothing else new)
alter table public.profiles
  add column if not exists show_on_leaderboard boolean not null default true;

grant update (show_on_leaderboard) on public.profiles to authenticated;


-- 2. Score weights: a single row the super admin can edit
create table if not exists public.score_settings (
  id                       boolean primary key default true check (id),
  points_per_solved        integer not null default 10 check (points_per_solved between 0 and 1000),
  points_per_contest       integer not null default 25 check (points_per_contest between 0 and 1000),
  points_per_contribution  integer not null default 2  check (points_per_contribution between 0 and 1000),
  contribution_daily_cap   integer not null default 10 check (contribution_daily_cap between 0 and 1000),
  points_per_active_day    integer not null default 5  check (points_per_active_day between 0 and 1000),
  updated_at               timestamptz not null default now()
);

insert into public.score_settings (id) values (true) on conflict (id) do nothing;

alter table public.score_settings enable row level security;

-- Everyone logged in may read the weights (scoring is transparent)
drop policy if exists "score_settings: read" on public.score_settings;
create policy "score_settings: read"
  on public.score_settings for select to authenticated
  using (true);

revoke all on public.score_settings from anon, authenticated;
grant select on public.score_settings to authenticated;
grant all    on public.score_settings to service_role;


-- 3. The leaderboard
--    p_days: 7, 30, or 3650 (about "all time"). Days follow Bangladesh time.
--    prev_score is the score for the equal-length period just before,
--    which powers the "most improved" view.
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
  -- Only approved members may call this
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
    select p.id as eid, p.full_name as ename, p.batch as ebatch
    from public.profiles p
    where p.status = 'approved' and p.show_on_leaderboard
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
