-- Reminder hardening:
-- 1. A rate limit for test notifications that users cannot bypass.
-- 2. Reminders late in the evening (e.g. 23:30) stay due after local midnight. The reminder
--    belongs to the day of its reminder time, and the three-hour window may cross midnight.

-- ---------------------------------------------------------------------------
-- Test notification rate limit
-- ---------------------------------------------------------------------------
create table public.push_test_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index push_test_log_user_idx on public.push_test_log (user_id, created_at desc);
-- No policies: only claim_push_test() reads and writes this table.
alter table public.push_test_log enable row level security;

-- Returns false when the user already sent 5 test notifications in the last hour.
create or replace function public.claim_push_test()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || 'push_test', 0));
  if (select count(*) from public.push_test_log where user_id = v_uid and created_at > now() - interval '1 hour') >= 5 then
    return false;
  end if;
  insert into public.push_test_log (user_id) values (v_uid);
  return true;
end;
$$;
revoke all on function public.claim_push_test() from public, anon;
grant execute on function public.claim_push_test() to authenticated;

-- ---------------------------------------------------------------------------
-- Due reminders
-- ---------------------------------------------------------------------------
-- reminder_day is the local date whose reminder time most recently passed, so a 23:30
-- reminder is still due at 00:15. All checks (planned weekday, sessions, diary, delivery log)
-- use that day.
create or replace function public.reminder_candidates(p_now timestamptz default now())
returns table (user_id uuid, kind text, local_date date, detail text)
language sql
stable
security invoker
set search_path = ''
as $$
  with prefs as materialized (
    select
      up.user_id,
      up.reminder_timezone as tz,
      up.workout_reminder_time,
      up.meal_reminder_time,
      (p_now at time zone up.reminder_timezone) as local_ts
    from public.user_preferences up
    where (up.workout_reminder_time is not null or up.meal_reminder_time is not null)
      and up.reminder_timezone in (select name from pg_catalog.pg_timezone_names)
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = up.user_id)
  ),
  due as (
    select p.user_id, p.tz, 'workout'::text as kind, (p.local_ts - p.workout_reminder_time::interval)::date as reminder_day,
           p.workout_reminder_time as reminder_time, p.local_ts
    from prefs p
    where p.workout_reminder_time is not null
    union all
    select p.user_id, p.tz, 'meal_log'::text, (p.local_ts - p.meal_reminder_time::interval)::date,
           p.meal_reminder_time, p.local_ts
    from prefs p
    where p.meal_reminder_time is not null
  ),
  open_window as (
    select d.*
    from due d
    where d.local_ts < d.reminder_day + d.reminder_time + interval '3 hours'
      and not exists (
        select 1 from public.notification_deliveries nd
        where nd.user_id = d.user_id and nd.kind = d.kind and nd.local_date = d.reminder_day
      )
  )
  select w.user_id, w.kind, w.reminder_day, day.name
  from open_window w
  cross join lateral (
    select pd.name
    from public.workout_programs wp
    join public.program_days pd on pd.program_id = wp.id
    where wp.user_id = w.user_id
      and wp.is_active
      and not pd.is_rest_day
      and pd.weekday = extract(isodow from w.reminder_day)::int
    order by pd.position
    limit 1
  ) day
  where w.kind = 'workout'
    and not exists (
      select 1 from public.workout_sessions ws
      where ws.user_id = w.user_id
        and (ws.status in ('in_progress', 'paused') or (ws.started_at at time zone w.tz)::date = w.reminder_day)
    )
  union all
  select w.user_id, w.kind, w.reminder_day, null::text
  from open_window w
  where w.kind = 'meal_log'
    and not exists (
      select 1 from public.diary_entries de
      where de.user_id = w.user_id and de.entry_date = w.reminder_day
    );
$$;
revoke all on function public.reminder_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.reminder_candidates(timestamptz) to service_role;
