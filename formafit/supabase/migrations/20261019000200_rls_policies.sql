-- Row Level Security: every private record is scoped to its authenticated owner.
-- Child rows additionally require that the parent row belongs to the same user so a
-- user can never attach data to (or move data into) another user's plan, list or session.

-- Enable RLS on every table in the public schema.
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables that are owned directly through user_id with no parent relation
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'nutrition_targets', 'user_preferences', 'water_logs', 'measurements', 'progress_photos',
    'ai_conversations', 'recipes', 'meal_plans', 'workout_programs', 'workout_sessions',
    'shopping_lists', 'meal_consumptions'
  ] loop
    execute format(
      'create policy "%1$s_select_own" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s_insert_own" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s_update_own" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s_delete_own" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Foods: shared reference rows (owner_id is null) are readable by every signed-in
-- user; only the owner can create, change or delete their own foods.
-- ---------------------------------------------------------------------------
create policy "foods_select_visible" on public.foods
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "foods_insert_own" on public.foods
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "foods_update_own" on public.foods
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "foods_delete_own" on public.foods
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "food_servings_select_visible" on public.food_servings
  for select to authenticated using (
    exists (select 1 from public.foods f where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid())))
  );
create policy "food_servings_insert_own" on public.food_servings
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.foods f where f.id = food_id and f.owner_id = (select auth.uid()))
  );
create policy "food_servings_update_own" on public.food_servings
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.foods f where f.id = food_id and f.owner_id = (select auth.uid()))
  );
create policy "food_servings_delete_own" on public.food_servings
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "favorite_foods_select_own" on public.favorite_foods
  for select to authenticated using (user_id = (select auth.uid()));
create policy "favorite_foods_insert_own" on public.favorite_foods
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.foods f where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid())))
  );
create policy "favorite_foods_delete_own" on public.favorite_foods
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Exercises: same visibility model as foods
-- ---------------------------------------------------------------------------
create policy "exercises_select_visible" on public.exercises
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
create policy "exercises_insert_own" on public.exercises
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "exercises_update_own" on public.exercises
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "exercises_delete_own" on public.exercises
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Child tables with parent ownership checks
-- ---------------------------------------------------------------------------

-- recipe_ingredients -> recipes, foods
create policy "recipe_ingredients_select_own" on public.recipe_ingredients
  for select to authenticated using (user_id = (select auth.uid()));
create policy "recipe_ingredients_write_own" on public.recipe_ingredients
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
    and exists (select 1 from public.foods f where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid())))
  );
create policy "recipe_ingredients_update_own" on public.recipe_ingredients
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
    and exists (select 1 from public.foods f where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid())))
  );
create policy "recipe_ingredients_delete_own" on public.recipe_ingredients
  for delete to authenticated using (user_id = (select auth.uid()));

-- planned_meals -> meal_plans
create policy "planned_meals_select_own" on public.planned_meals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "planned_meals_insert_own" on public.planned_meals
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );
create policy "planned_meals_update_own" on public.planned_meals
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );
create policy "planned_meals_delete_own" on public.planned_meals
  for delete to authenticated using (user_id = (select auth.uid()));

-- planned_meal_ingredients -> planned_meals, foods
create policy "planned_meal_ingredients_select_own" on public.planned_meal_ingredients
  for select to authenticated using (user_id = (select auth.uid()));
create policy "planned_meal_ingredients_insert_own" on public.planned_meal_ingredients
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.planned_meals m where m.id = planned_meal_id and m.user_id = (select auth.uid()))
    and exists (select 1 from public.foods f where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid())))
  );
create policy "planned_meal_ingredients_update_own" on public.planned_meal_ingredients
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.planned_meals m where m.id = planned_meal_id and m.user_id = (select auth.uid()))
    and exists (select 1 from public.foods f where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid())))
  );
create policy "planned_meal_ingredients_delete_own" on public.planned_meal_ingredients
  for delete to authenticated using (user_id = (select auth.uid()));

-- diary_entries -> foods (optional), recipes (optional), meal_consumptions (optional)
create policy "diary_entries_select_own" on public.diary_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "diary_entries_insert_own" on public.diary_entries
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (food_id is null or exists (
      select 1 from public.foods f where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid()))))
    and (recipe_id is null or exists (
      select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())))
    and (consumption_id is null or exists (
      select 1 from public.meal_consumptions c where c.id = consumption_id and c.user_id = (select auth.uid())))
  );
create policy "diary_entries_update_own" on public.diary_entries
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and (food_id is null or exists (
      select 1 from public.foods f where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid()))))
    and (recipe_id is null or exists (
      select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())))
    and (consumption_id is null or exists (
      select 1 from public.meal_consumptions c where c.id = consumption_id and c.user_id = (select auth.uid())))
  );
create policy "diary_entries_delete_own" on public.diary_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- program_days -> workout_programs
create policy "program_days_select_own" on public.program_days
  for select to authenticated using (user_id = (select auth.uid()));
create policy "program_days_insert_own" on public.program_days
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_programs p where p.id = program_id and p.user_id = (select auth.uid()))
  );
create policy "program_days_update_own" on public.program_days
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_programs p where p.id = program_id and p.user_id = (select auth.uid()))
  );
create policy "program_days_delete_own" on public.program_days
  for delete to authenticated using (user_id = (select auth.uid()));

-- program_exercises -> program_days, exercises
create policy "program_exercises_select_own" on public.program_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy "program_exercises_insert_own" on public.program_exercises
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.program_days d where d.id = program_day_id and d.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))
  );
create policy "program_exercises_update_own" on public.program_exercises
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.program_days d where d.id = program_day_id and d.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))
  );
create policy "program_exercises_delete_own" on public.program_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

-- session_exercises -> workout_sessions, exercises
create policy "session_exercises_select_own" on public.session_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy "session_exercises_insert_own" on public.session_exercises
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))
  );
create policy "session_exercises_update_own" on public.session_exercises
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))
  );
create policy "session_exercises_delete_own" on public.session_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

-- session_sets -> session_exercises (and the same session)
create policy "session_sets_select_own" on public.session_sets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "session_sets_insert_own" on public.session_sets
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.session_exercises se
      where se.id = session_exercise_id and se.session_id = session_sets.session_id and se.user_id = (select auth.uid()))
  );
create policy "session_sets_update_own" on public.session_sets
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.session_exercises se
      where se.id = session_exercise_id and se.session_id = session_sets.session_id and se.user_id = (select auth.uid()))
  );
create policy "session_sets_delete_own" on public.session_sets
  for delete to authenticated using (user_id = (select auth.uid()));

-- shopping_list_items -> shopping_lists
create policy "shopping_list_items_select_own" on public.shopping_list_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "shopping_list_items_insert_own" on public.shopping_list_items
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = (select auth.uid()))
  );
create policy "shopping_list_items_update_own" on public.shopping_list_items
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = (select auth.uid()))
  );
create policy "shopping_list_items_delete_own" on public.shopping_list_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- ai_messages -> ai_conversations
create policy "ai_messages_select_own" on public.ai_messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_messages_insert_own" on public.ai_messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
  );
create policy "ai_messages_delete_own" on public.ai_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- ai_request_log: append-only for the owner (no update/delete so limits cannot be reset)
create policy "ai_request_log_select_own" on public.ai_request_log
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_request_log_insert_own" on public.ai_request_log
  for insert to authenticated with check (user_id = (select auth.uid()));
