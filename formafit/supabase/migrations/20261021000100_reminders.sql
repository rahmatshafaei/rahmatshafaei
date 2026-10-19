-- Push reminders: per-device Web Push subscriptions, reminder settings and a delivery log.
--
-- Reminders are only sent when the data supports them: a workout reminder needs a planned
-- training day in the active program and no session started that day; a logging reminder is
-- only sent when nothing has been logged in the diary that day.

-- ---------------------------------------------------------------------------
-- Settings (a null time means the reminder is off). Times are local to reminder_timezone.
-- ---------------------------------------------------------------------------
alter table public.user_preferences
  add column reminder_timezone text not null default 'Europe/Stockholm'
    check (char_length(reminder_timezone) between 1 and 64),
  add column workout_reminder_time time,
  add column meal_reminder_time time;

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 12 and 2048 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 16 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
-- No insert/update policies: registration goes through register_push_subscription().

-- ---------------------------------------------------------------------------
-- Delivery log: at most one reminder of each kind per user and local day.
-- ---------------------------------------------------------------------------
create table public.notification_deliveries (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('workout', 'meal_log')),
  local_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, local_date)
);

alter table public.notification_deliveries enable row level security;
create policy "notification_deliveries_select_own" on public.notification_deliveries
  for select to authenticated using (user_id = (select auth.uid()));
-- Written only by the reminder job (service role).

-- ---------------------------------------------------------------------------
-- Registration
-- ---------------------------------------------------------------------------
-- An endpoint identifies one browser profile and is only known to that browser. Whoever
-- registers it now owns it, so on a shared device a previous account stops receiving its
-- reminders there. Each user keeps at most 10 devices (oldest are dropped).
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
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

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now(),
        last_success_at = null;

  delete from public.push_subscriptions
  where id in (
    select id from public.push_subscriptions
    where user_id = v_uid
    order by created_at desc
    offset 10
  );
end;
$$;
revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Due reminders (for the reminder job only)
-- ---------------------------------------------------------------------------
-- A reminder is due from its local time and for three hours after it, so a job that runs every
-- 5-60 minutes sends it once (the delivery log prevents repeats). Unknown time zones are skipped.
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
  )
  select p.user_id, 'workout'::text, p.local_ts::date, d.name
  from prefs p
  cross join lateral (
    select pd.name
    from public.workout_programs wp
    join public.program_days pd on pd.program_id = wp.id
    where wp.user_id = p.user_id
      and wp.is_active
      and not pd.is_rest_day
      and pd.weekday = extract(isodow from p.local_ts)::int
    order by pd.position
    limit 1
  ) d
  where p.workout_reminder_time is not null
    and p.local_ts >= p.local_ts::date + p.workout_reminder_time
    and p.local_ts < p.local_ts::date + p.workout_reminder_time + interval '3 hours'
    and not exists (
      select 1 from public.workout_sessions ws
      where ws.user_id = p.user_id
        and (ws.status in ('in_progress', 'paused') or (ws.started_at at time zone p.tz)::date = p.local_ts::date)
    )
    and not exists (
      select 1 from public.notification_deliveries nd
      where nd.user_id = p.user_id and nd.kind = 'workout' and nd.local_date = p.local_ts::date
    )
  union all
  select p.user_id, 'meal_log'::text, p.local_ts::date, null::text
  from prefs p
  where p.meal_reminder_time is not null
    and p.local_ts >= p.local_ts::date + p.meal_reminder_time
    and p.local_ts < p.local_ts::date + p.meal_reminder_time + interval '3 hours'
    and not exists (
      select 1 from public.diary_entries de
      where de.user_id = p.user_id and de.entry_date = p.local_ts::date
    )
    and not exists (
      select 1 from public.notification_deliveries nd
      where nd.user_id = p.user_id and nd.kind = 'meal_log' and nd.local_date = p.local_ts::date
    );
$$;
revoke all on function public.reminder_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.reminder_candidates(timestamptz) to service_role;
