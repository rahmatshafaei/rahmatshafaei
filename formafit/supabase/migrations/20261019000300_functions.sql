-- Transactional operations. All functions are SECURITY INVOKER, so Row Level Security
-- applies to every statement they run; they additionally verify ownership explicitly
-- and raise a clear error instead of silently doing nothing.

-- ---------------------------------------------------------------------------
-- Meal plans -> food diary
-- ---------------------------------------------------------------------------

-- Copies a planned meal's ingredients into the diary for a date. Idempotent: calling it
-- again for the same meal and date returns the existing consumption and inserts nothing.
create or replace function public.mark_planned_meal_eaten(p_planned_meal_id uuid, p_date date)
returns table (consumption_id uuid, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_meal public.planned_meals%rowtype;
  v_consumption_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_meal from public.planned_meals where id = p_planned_meal_id and user_id = v_uid;
  if not found then
    raise exception 'planned meal not found' using errcode = 'P0002';
  end if;

  insert into public.meal_consumptions (user_id, planned_meal_id, consumed_on, meal_slot, meal_name)
  values (v_uid, v_meal.id, p_date, v_meal.meal_slot, v_meal.name)
  on conflict (planned_meal_id, consumed_on) do nothing
  returning id into v_consumption_id;

  if v_consumption_id is null then
    select c.id into v_consumption_id
    from public.meal_consumptions c
    where c.planned_meal_id = v_meal.id and c.consumed_on = p_date;
    return query select v_consumption_id, false;
    return;
  end if;

  insert into public.diary_entries (
    user_id, entry_date, meal_slot, position, food_id, food_name, brand, quantity_g,
    kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
    verification, consumption_id, source_ingredient_id, recipe_name
  )
  select
    v_uid, p_date, v_meal.meal_slot, i.position, f.id, f.name, f.brand, i.quantity_g,
    f.kcal_per_100g, f.protein_per_100g, f.carbs_per_100g, f.fat_per_100g, f.fiber_per_100g,
    f.verification, v_consumption_id, i.id, v_meal.name
  from public.planned_meal_ingredients i
  join public.foods f on f.id = i.food_id
  where i.planned_meal_id = v_meal.id
  order by i.position
  on conflict (consumption_id, source_ingredient_id) do nothing;

  return query select v_consumption_id, true;
end;
$$;

-- Removes a consumption and the diary rows it created (explicit user "undo").
create or replace function public.undo_meal_consumption(p_consumption_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.meal_consumptions where id = p_consumption_id and user_id = v_uid) then
    raise exception 'consumption not found' using errcode = 'P0002';
  end if;
  delete from public.diary_entries where consumption_id = p_consumption_id and user_id = v_uid;
  delete from public.meal_consumptions where id = p_consumption_id and user_id = v_uid;
end;
$$;

-- Copies diary entries from one date to another (optionally a single meal slot).
-- Copies are plain entries: they are not linked to a meal plan consumption.
create or replace function public.copy_diary_entries(
  p_from date,
  p_to date,
  p_slot public.meal_slot default null,
  p_target_slot public.meal_slot default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_target_slot is not null and p_slot is null then
    raise exception 'target slot requires a source slot' using errcode = '22023';
  end if;

  insert into public.diary_entries (
    user_id, entry_date, meal_slot, position, food_id, food_name, brand, quantity_g,
    kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
    verification, recipe_id, recipe_name, note
  )
  select
    v_uid, p_to, coalesce(p_target_slot, d.meal_slot), d.position, d.food_id, d.food_name, d.brand, d.quantity_g,
    d.kcal_per_100g, d.protein_per_100g, d.carbs_per_100g, d.fat_per_100g, d.fiber_per_100g,
    d.verification, d.recipe_id, d.recipe_name, d.note
  from public.diary_entries d
  where d.user_id = v_uid and d.entry_date = p_from and (p_slot is null or d.meal_slot = p_slot)
  order by d.meal_slot, d.position, d.created_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Meal plan creation / copying (atomic)
-- ---------------------------------------------------------------------------

-- Creates a meal plan with meals and ingredients from a validated JSON document:
-- { name, start_date, num_days, source, notes, generation_meta,
--   meals: [{ day_index, position, name, meal_slot, meal_time, instructions, prep_minutes, notes,
--             ingredients: [{ food_id, quantity_g, position, note }] }] }
create or replace function public.create_meal_plan(p_plan jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan_id uuid;
  v_meal jsonb;
  v_meal_id uuid;
  v_ing jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.meal_plans (user_id, name, start_date, num_days, source, notes, generation_meta)
  values (
    v_uid,
    p_plan ->> 'name',
    (p_plan ->> 'start_date')::date,
    coalesce((p_plan ->> 'num_days')::smallint, 7),
    coalesce((p_plan ->> 'source')::public.plan_source, 'manual'),
    p_plan ->> 'notes',
    p_plan -> 'generation_meta'
  )
  returning id into v_plan_id;

  for v_meal in select * from jsonb_array_elements(coalesce(p_plan -> 'meals', '[]'::jsonb)) loop
    insert into public.planned_meals (
      plan_id, user_id, day_index, position, name, meal_slot, meal_time, instructions, prep_minutes, notes
    ) values (
      v_plan_id, v_uid,
      (v_meal ->> 'day_index')::smallint,
      coalesce((v_meal ->> 'position')::integer, 0),
      v_meal ->> 'name',
      coalesce((v_meal ->> 'meal_slot')::public.meal_slot, 'lunch'),
      nullif(v_meal ->> 'meal_time', '')::time,
      v_meal ->> 'instructions',
      (v_meal ->> 'prep_minutes')::smallint,
      v_meal ->> 'notes'
    ) returning id into v_meal_id;

    for v_ing in select * from jsonb_array_elements(coalesce(v_meal -> 'ingredients', '[]'::jsonb)) loop
      insert into public.planned_meal_ingredients (planned_meal_id, user_id, food_id, quantity_g, position, note)
      values (
        v_meal_id, v_uid,
        (v_ing ->> 'food_id')::uuid,
        (v_ing ->> 'quantity_g')::numeric,
        coalesce((v_ing ->> 'position')::integer, 0),
        v_ing ->> 'note'
      );
    end loop;
  end loop;

  return v_plan_id;
end;
$$;

-- Copies all meals of one plan day to another day of the same plan.
-- p_replace = true removes the target day's meals first (the UI asks for confirmation).
create or replace function public.copy_plan_day(p_plan_id uuid, p_from_day smallint, p_to_day smallint, p_replace boolean default false)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_num_days smallint;
  v_meal public.planned_meals%rowtype;
  v_new_id uuid;
  v_offset integer := 0;
  v_count integer := 0;
begin
  select num_days into v_num_days from public.meal_plans where id = p_plan_id and user_id = v_uid;
  if not found then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;
  if p_to_day < 0 or p_to_day >= v_num_days or p_from_day = p_to_day then
    raise exception 'invalid target day' using errcode = '22023';
  end if;

  if p_replace then
    delete from public.planned_meals where plan_id = p_plan_id and day_index = p_to_day and user_id = v_uid;
  else
    select coalesce(max(position) + 1, 0) into v_offset
    from public.planned_meals where plan_id = p_plan_id and day_index = p_to_day;
  end if;

  for v_meal in
    select * from public.planned_meals
    where plan_id = p_plan_id and day_index = p_from_day and user_id = v_uid
    order by position
  loop
    insert into public.planned_meals (
      plan_id, user_id, day_index, position, name, meal_slot, meal_time, instructions,
      prep_minutes, image_path, notes, source_recipe_id
    ) values (
      p_plan_id, v_uid, p_to_day, v_meal.position + v_offset, v_meal.name, v_meal.meal_slot, v_meal.meal_time,
      v_meal.instructions, v_meal.prep_minutes, v_meal.image_path, v_meal.notes, v_meal.source_recipe_id
    ) returning id into v_new_id;

    insert into public.planned_meal_ingredients (planned_meal_id, user_id, food_id, quantity_g, position, note)
    select v_new_id, v_uid, food_id, quantity_g, position, note
    from public.planned_meal_ingredients where planned_meal_id = v_meal.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Duplicates a single planned meal (with ingredients) directly after itself.
create or replace function public.duplicate_planned_meal(p_meal_id uuid, p_target_day smallint default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_meal public.planned_meals%rowtype;
  v_new_id uuid;
  v_day smallint;
  v_position integer;
begin
  select * into v_meal from public.planned_meals where id = p_meal_id and user_id = v_uid;
  if not found then
    raise exception 'planned meal not found' using errcode = 'P0002';
  end if;
  v_day := coalesce(p_target_day, v_meal.day_index);
  if v_day = v_meal.day_index then
    v_position := v_meal.position + 1;
    update public.planned_meals set position = position + 1
    where plan_id = v_meal.plan_id and day_index = v_day and position > v_meal.position;
  else
    select coalesce(max(position) + 1, 0) into v_position
    from public.planned_meals where plan_id = v_meal.plan_id and day_index = v_day;
  end if;

  insert into public.planned_meals (
    plan_id, user_id, day_index, position, name, meal_slot, meal_time, instructions,
    prep_minutes, image_path, notes, source_recipe_id
  ) values (
    v_meal.plan_id, v_uid, v_day, v_position, v_meal.name, v_meal.meal_slot, v_meal.meal_time,
    v_meal.instructions, v_meal.prep_minutes, v_meal.image_path, v_meal.notes, v_meal.source_recipe_id
  ) returning id into v_new_id;

  insert into public.planned_meal_ingredients (planned_meal_id, user_id, food_id, quantity_g, position, note)
  select v_new_id, v_uid, food_id, quantity_g, position, note
  from public.planned_meal_ingredients where planned_meal_id = v_meal.id;

  return v_new_id;
end;
$$;

-- Copies an entire plan into a new plan (e.g. to reuse a week with a new start date).
create or replace function public.duplicate_meal_plan(p_plan_id uuid, p_name text, p_start_date date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.meal_plans%rowtype;
  v_new_plan uuid;
  v_meal public.planned_meals%rowtype;
  v_new_meal uuid;
begin
  select * into v_plan from public.meal_plans where id = p_plan_id and user_id = v_uid;
  if not found then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;

  insert into public.meal_plans (user_id, name, start_date, num_days, source, notes)
  values (v_uid, p_name, p_start_date, v_plan.num_days, v_plan.source, v_plan.notes)
  returning id into v_new_plan;

  for v_meal in select * from public.planned_meals where plan_id = p_plan_id order by day_index, position loop
    insert into public.planned_meals (
      plan_id, user_id, day_index, position, name, meal_slot, meal_time, instructions,
      prep_minutes, image_path, notes, source_recipe_id
    ) values (
      v_new_plan, v_uid, v_meal.day_index, v_meal.position, v_meal.name, v_meal.meal_slot, v_meal.meal_time,
      v_meal.instructions, v_meal.prep_minutes, v_meal.image_path, v_meal.notes, v_meal.source_recipe_id
    ) returning id into v_new_meal;

    insert into public.planned_meal_ingredients (planned_meal_id, user_id, food_id, quantity_g, position, note)
    select v_new_meal, v_uid, food_id, quantity_g, position, note
    from public.planned_meal_ingredients where planned_meal_id = v_meal.id;
  end loop;

  return v_new_plan;
end;
$$;

-- ---------------------------------------------------------------------------
-- Training programs
-- ---------------------------------------------------------------------------

-- { name, split_type, description, source, generation_meta,
--   days: [{ position, name, weekday, is_rest_day, notes,
--            exercises: [{ exercise_id, position, sets, rep_min, rep_max, suggested_weight_kg,
--                          rest_seconds, tempo, superset_group, notes }] }] }
create or replace function public.create_workout_program(p_program jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_program_id uuid;
  v_day jsonb;
  v_day_id uuid;
  v_ex jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.workout_programs (user_id, name, split_type, description, source, generation_meta, is_template)
  values (
    v_uid,
    p_program ->> 'name',
    coalesce((p_program ->> 'split_type')::public.split_type, 'custom'),
    p_program ->> 'description',
    coalesce((p_program ->> 'source')::public.plan_source, 'manual'),
    p_program -> 'generation_meta',
    coalesce((p_program ->> 'is_template')::boolean, false)
  )
  returning id into v_program_id;

  for v_day in select * from jsonb_array_elements(coalesce(p_program -> 'days', '[]'::jsonb)) loop
    insert into public.program_days (program_id, user_id, position, name, weekday, is_rest_day, notes)
    values (
      v_program_id, v_uid,
      coalesce((v_day ->> 'position')::integer, 0),
      v_day ->> 'name',
      (v_day ->> 'weekday')::smallint,
      coalesce((v_day ->> 'is_rest_day')::boolean, false),
      v_day ->> 'notes'
    ) returning id into v_day_id;

    for v_ex in select * from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb)) loop
      insert into public.program_exercises (
        program_day_id, user_id, exercise_id, position, sets, rep_min, rep_max,
        suggested_weight_kg, rest_seconds, tempo, superset_group, notes
      ) values (
        v_day_id, v_uid,
        (v_ex ->> 'exercise_id')::uuid,
        coalesce((v_ex ->> 'position')::integer, 0),
        coalesce((v_ex ->> 'sets')::smallint, 3),
        coalesce((v_ex ->> 'rep_min')::smallint, 8),
        coalesce((v_ex ->> 'rep_max')::smallint, 12),
        (v_ex ->> 'suggested_weight_kg')::numeric,
        coalesce((v_ex ->> 'rest_seconds')::smallint, 90),
        nullif(v_ex ->> 'tempo', ''),
        (v_ex ->> 'superset_group')::smallint,
        v_ex ->> 'notes'
      );
    end loop;
  end loop;

  return v_program_id;
end;
$$;

create or replace function public.duplicate_workout_program(p_program_id uuid, p_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_program public.workout_programs%rowtype;
  v_new_program uuid;
  v_day public.program_days%rowtype;
  v_new_day uuid;
begin
  select * into v_program from public.workout_programs where id = p_program_id and user_id = v_uid;
  if not found then
    raise exception 'program not found' using errcode = 'P0002';
  end if;

  insert into public.workout_programs (user_id, name, split_type, description, source, is_template)
  values (v_uid, p_name, v_program.split_type, v_program.description, v_program.source, false)
  returning id into v_new_program;

  for v_day in select * from public.program_days where program_id = p_program_id order by position loop
    insert into public.program_days (program_id, user_id, position, name, weekday, is_rest_day, notes)
    values (v_new_program, v_uid, v_day.position, v_day.name, v_day.weekday, v_day.is_rest_day, v_day.notes)
    returning id into v_new_day;

    insert into public.program_exercises (
      program_day_id, user_id, exercise_id, position, sets, rep_min, rep_max,
      suggested_weight_kg, rest_seconds, tempo, superset_group, notes
    )
    select v_new_day, v_uid, exercise_id, position, sets, rep_min, rep_max,
      suggested_weight_kg, rest_seconds, tempo, superset_group, notes
    from public.program_exercises where program_day_id = v_day.id;
  end loop;

  return v_new_program;
end;
$$;

-- Makes one program the active one (only one active program per user).
create or replace function public.set_active_program(p_program_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.workout_programs where id = p_program_id and user_id = v_uid) then
    raise exception 'program not found' using errcode = 'P0002';
  end if;
  update public.workout_programs set is_active = false where user_id = v_uid and is_active and id <> p_program_id;
  update public.workout_programs set is_active = true where id = p_program_id and user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workout sessions
-- ---------------------------------------------------------------------------

-- Starts a session from a program day (or an empty session when p_program_day_id is null)
-- and creates one pending set row per planned set. Only one open session per user.
create or replace function public.start_workout_session(
  p_program_day_id uuid default null,
  p_scheduled_for date default null,
  p_name text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day public.program_days%rowtype;
  v_session_id uuid;
  v_ex public.program_exercises%rowtype;
  v_session_ex_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if exists (select 1 from public.workout_sessions where user_id = v_uid and status in ('in_progress', 'paused')) then
    raise exception 'an open workout session already exists' using errcode = '23505';
  end if;

  if p_program_day_id is not null then
    select * into v_day from public.program_days where id = p_program_day_id and user_id = v_uid;
    if not found then
      raise exception 'program day not found' using errcode = 'P0002';
    end if;
    if v_day.is_rest_day then
      raise exception 'cannot start a rest day' using errcode = '22023';
    end if;
  end if;

  insert into public.workout_sessions (user_id, program_id, program_day_id, name, scheduled_for)
  values (
    v_uid, v_day.program_id, v_day.id,
    coalesce(nullif(p_name, ''), v_day.name, 'Fritt pass'),
    coalesce(p_scheduled_for, current_date)
  )
  returning id into v_session_id;

  if p_program_day_id is not null then
    for v_ex in select * from public.program_exercises where program_day_id = v_day.id order by position loop
      insert into public.session_exercises (
        session_id, user_id, exercise_id, program_exercise_id, position, rep_min, rep_max,
        rest_seconds, tempo, superset_group, notes
      ) values (
        v_session_id, v_uid, v_ex.exercise_id, v_ex.id, v_ex.position, v_ex.rep_min, v_ex.rep_max,
        v_ex.rest_seconds, v_ex.tempo, v_ex.superset_group, null
      ) returning id into v_session_ex_id;

      insert into public.session_sets (session_exercise_id, session_id, user_id, set_number, target_reps, target_weight_kg)
      select v_session_ex_id, v_session_id, v_uid, n, v_ex.rep_max, v_ex.suggested_weight_kg
      from generate_series(1, v_ex.sets) as n;
    end loop;
  end if;

  return v_session_id;
end;
$$;

-- Completes a session. A session can only be completed when at least one set was logged,
-- so a scheduled workout is never shown as done without recorded work.
create or replace function public.complete_workout_session(
  p_session_id uuid,
  p_feedback public.session_feedback default null,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.workout_sessions%rowtype;
begin
  select * into v_session from public.workout_sessions where id = p_session_id and user_id = v_uid for update;
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if v_session.status not in ('in_progress', 'paused') then
    raise exception 'session is not open' using errcode = '22023';
  end if;
  if not exists (select 1 from public.session_sets where session_id = p_session_id and is_completed) then
    raise exception 'no completed sets' using errcode = '22023';
  end if;

  update public.workout_sessions set
    status = 'completed',
    completed_at = now(),
    paused_seconds = paused_seconds + case
      when status = 'paused' and paused_at is not null then extract(epoch from (now() - paused_at))::integer
      else 0 end,
    paused_at = null,
    feedback = coalesce(p_feedback, feedback),
    notes = coalesce(p_notes, notes)
  where id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- AI rate limiting
-- ---------------------------------------------------------------------------

-- Records an AI request and returns false when the user exceeded p_limit requests
-- of this kind within the last p_window_minutes.
create or replace function public.consume_ai_quota(p_kind text, p_limit integer, p_window_minutes integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Serialize concurrent requests of the same user.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_kind, 0));

  select count(*) into v_count from public.ai_request_log
  where user_id = v_uid and kind = p_kind and created_at > now() - make_interval(mins => p_window_minutes);

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.ai_request_log (user_id, kind) values (v_uid, p_kind);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: callable by signed-in users only.
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'mark_planned_meal_eaten', 'undo_meal_consumption', 'copy_diary_entries', 'create_meal_plan',
        'copy_plan_day', 'duplicate_planned_meal', 'duplicate_meal_plan', 'create_workout_program',
        'duplicate_workout_program', 'set_active_program', 'start_workout_session',
        'complete_workout_session', 'consume_ai_quota'
      )
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end;
$$;
