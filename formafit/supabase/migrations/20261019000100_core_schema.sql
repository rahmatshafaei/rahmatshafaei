-- FormaFit core schema
-- All private tables carry a user_id column that is enforced by Row Level Security
-- (see 20261019000200_rls_policies.sql). Nutrition values are stored per 100 g with
-- enough decimal precision for deterministic calculations; rounding happens only in the UI.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.goal_type as enum ('fat_loss', 'muscle_gain', 'maintenance');
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type public.experience_level as enum ('beginner', 'intermediate', 'advanced');
create type public.sex_type as enum ('male', 'female', 'unspecified');
create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.food_source as enum ('livsmedelsverket', 'openfoodfacts', 'user', 'starter_reference');
create type public.verification_status as enum ('verified', 'community', 'user_entered', 'estimated');
create type public.grocery_category as enum ('meat_fish', 'dairy', 'grains', 'produce', 'pantry', 'other');
create type public.food_preparation as enum ('raw', 'cooked', 'dried', 'as_sold');
create type public.plan_source as enum ('manual', 'ai');
create type public.split_type as enum ('push_pull_legs', 'upper_lower', 'full_body', 'bro_split', 'custom');
create type public.session_status as enum ('in_progress', 'paused', 'completed', 'abandoned');
create type public.session_feedback as enum ('too_easy', 'just_right', 'too_hard');
create type public.chat_role as enum ('user', 'assistant');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Profiles, targets and preferences
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  age smallint check (age is null or age between 13 and 100),
  sex public.sex_type not null default 'unspecified',
  height_cm numeric(5, 1) check (height_cm is null or height_cm between 100 and 250),
  start_weight_kg numeric(5, 2) check (start_weight_kg is null or start_weight_kg between 30 and 350),
  goal_weight_kg numeric(5, 2) check (goal_weight_kg is null or goal_weight_kg between 30 and 350),
  activity_level public.activity_level,
  daily_steps integer check (daily_steps is null or daily_steps between 0 and 100000),
  training_days_per_week smallint check (training_days_per_week is null or training_days_per_week between 0 and 7),
  goal public.goal_type,
  diet_preferences text[] not null default '{}',
  allergies text[] not null default '{}',
  food_restrictions text[] not null default '{}',
  meals_per_day smallint not null default 4 check (meals_per_day between 1 and 8),
  equipment text[] not null default '{}',
  experience public.experience_level,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.nutrition_targets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  calories integer not null check (calories between 800 and 10000),
  protein_g numeric(6, 1) not null check (protein_g between 0 and 600),
  carbs_g numeric(6, 1) not null check (carbs_g between 0 and 1500),
  fat_g numeric(6, 1) not null check (fat_g between 0 and 600),
  method text not null check (method in ('mifflin_st_jeor', 'manual')),
  bmr_kcal numeric(7, 1),
  activity_multiplier numeric(4, 3),
  tdee_kcal numeric(7, 1),
  goal_adjustment_pct numeric(5, 2),
  calculation_inputs jsonb,
  is_manually_adjusted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger nutrition_targets_updated_at before update on public.nutrition_targets
  for each row execute function public.set_updated_at();

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  water_goal_ml integer not null default 2500 check (water_goal_ml between 500 and 8000),
  default_rest_seconds smallint not null default 90 check (default_rest_seconds between 0 and 900),
  weight_increment_kg numeric(4, 2) not null default 2.5 check (weight_increment_kg between 0.25 and 10),
  ai_share_logs boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- Create the profile and preference rows when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Foods
-- ---------------------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  -- null owner = shared reference food (only created through migrations / service role)
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  brand text check (brand is null or char_length(brand) <= 120),
  barcode text check (barcode is null or barcode ~ '^[0-9]{6,14}$'),
  canonical_name text not null check (char_length(canonical_name) between 1 and 200),
  category public.grocery_category not null default 'other',
  preparation public.food_preparation not null default 'as_sold',
  kcal_per_100g numeric(7, 2) check (kcal_per_100g is null or kcal_per_100g between 0 and 900),
  protein_per_100g numeric(6, 2) check (protein_per_100g is null or protein_per_100g between 0 and 100),
  carbs_per_100g numeric(6, 2) check (carbs_per_100g is null or carbs_per_100g between 0 and 100),
  fat_per_100g numeric(6, 2) check (fat_per_100g is null or fat_per_100g between 0 and 100),
  fiber_per_100g numeric(6, 2) check (fiber_per_100g is null or fiber_per_100g between 0 and 100),
  allergens text[] not null default '{}',
  allergens_known boolean not null default false,
  diet_tags text[] not null default '{}',
  source public.food_source not null,
  source_ref text,
  source_note text,
  verification public.verification_status not null,
  image_path text,
  image_url text check (image_url is null or image_url ~ '^https://'),
  image_credit text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foods_macro_sum check (
    coalesce(protein_per_100g, 0) + coalesce(carbs_per_100g, 0) + coalesce(fat_per_100g, 0) <= 100.5
  ),
  constraint foods_user_image_path check (
    image_path is null or (owner_id is not null and image_path like owner_id::text || '/%')
  )
);
create trigger foods_updated_at before update on public.foods
  for each row execute function public.set_updated_at();
create index foods_owner_idx on public.foods (owner_id);
create index foods_name_trgm_idx on public.foods using gin (name extensions.gin_trgm_ops);
create unique index foods_barcode_per_owner_idx
  on public.foods (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), barcode)
  where barcode is not null;

create table public.food_servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  grams numeric(7, 2) not null check (grams > 0 and grams <= 5000),
  created_at timestamptz not null default now()
);
create index food_servings_food_idx on public.food_servings (food_id);

create table public.favorite_foods (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

-- ---------------------------------------------------------------------------
-- Recipes and saved meals
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'recipe' check (kind in ('recipe', 'meal')),
  name text not null check (char_length(name) between 1 and 120),
  servings numeric(5, 2) not null default 1 check (servings > 0 and servings <= 100),
  instructions text check (instructions is null or char_length(instructions) <= 10000),
  prep_minutes smallint check (prep_minutes is null or prep_minutes between 0 and 1440),
  default_slot public.meal_slot,
  image_path text check (image_path is null or image_path like user_id::text || '/%'),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();
create index recipes_user_idx on public.recipes (user_id);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  quantity_g numeric(8, 2) not null check (quantity_g > 0 and quantity_g <= 5000),
  position integer not null default 0,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

-- ---------------------------------------------------------------------------
-- Meal plans (planned meals are separate from consumed diary entries)
-- ---------------------------------------------------------------------------
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  start_date date not null,
  num_days smallint not null default 7 check (num_days between 1 and 28),
  source public.plan_source not null default 'manual',
  notes text check (notes is null or char_length(notes) <= 4000),
  generation_meta jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger meal_plans_updated_at before update on public.meal_plans
  for each row execute function public.set_updated_at();
create index meal_plans_user_idx on public.meal_plans (user_id, start_date);

create table public.planned_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_index smallint not null check (day_index between 0 and 27),
  position integer not null default 0,
  name text not null check (char_length(name) between 1 and 120),
  meal_slot public.meal_slot not null default 'lunch',
  meal_time time,
  instructions text check (instructions is null or char_length(instructions) <= 10000),
  prep_minutes smallint check (prep_minutes is null or prep_minutes between 0 and 1440),
  image_path text check (image_path is null or image_path like user_id::text || '/%'),
  notes text check (notes is null or char_length(notes) <= 2000),
  source_recipe_id uuid references public.recipes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger planned_meals_updated_at before update on public.planned_meals
  for each row execute function public.set_updated_at();
create index planned_meals_plan_idx on public.planned_meals (plan_id, day_index, position);

create table public.planned_meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  planned_meal_id uuid not null references public.planned_meals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  quantity_g numeric(8, 2) not null check (quantity_g > 0 and quantity_g <= 5000),
  position integer not null default 0,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger planned_meal_ingredients_updated_at before update on public.planned_meal_ingredients
  for each row execute function public.set_updated_at();
create index planned_meal_ingredients_meal_idx on public.planned_meal_ingredients (planned_meal_id, position);

-- Records that a planned meal was eaten on a date. The unique constraint makes the
-- "mark as eaten" operation idempotent. Deleting a plan keeps the history (set null).
create table public.meal_consumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  planned_meal_id uuid references public.planned_meals (id) on delete set null,
  consumed_on date not null,
  meal_slot public.meal_slot not null,
  meal_name text not null,
  created_at timestamptz not null default now(),
  unique (planned_meal_id, consumed_on)
);
create index meal_consumptions_user_idx on public.meal_consumptions (user_id, consumed_on);

-- ---------------------------------------------------------------------------
-- Food diary (stores a nutrition snapshot so history never changes silently)
-- ---------------------------------------------------------------------------
create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  meal_slot public.meal_slot not null,
  position integer not null default 0,
  food_id uuid references public.foods (id) on delete set null,
  food_name text not null check (char_length(food_name) between 1 and 200),
  brand text,
  quantity_g numeric(8, 2) not null check (quantity_g > 0 and quantity_g <= 5000),
  kcal_per_100g numeric(7, 2),
  protein_per_100g numeric(6, 2),
  carbs_per_100g numeric(6, 2),
  fat_per_100g numeric(6, 2),
  fiber_per_100g numeric(6, 2),
  verification public.verification_status not null,
  recipe_id uuid references public.recipes (id) on delete set null,
  recipe_name text,
  consumption_id uuid references public.meal_consumptions (id) on delete set null,
  source_ingredient_id uuid,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consumption_id, source_ingredient_id)
);
create trigger diary_entries_updated_at before update on public.diary_entries
  for each row execute function public.set_updated_at();
create index diary_entries_user_date_idx on public.diary_entries (user_id, entry_date);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  created_at timestamptz not null default now()
);
create index water_logs_user_date_idx on public.water_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- Exercises and training programs
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (char_length(name) between 1 and 120),
  primary_muscles text[] not null check (cardinality(primary_muscles) >= 1),
  secondary_muscles text[] not null default '{}',
  equipment text not null,
  mechanics text not null default 'compound' check (mechanics in ('compound', 'isolation')),
  instructions text[] not null default '{}',
  tips text,
  image_path text,
  image_url text check (image_url is null or image_url ~ '^https://'),
  image_credit text,
  video_url text check (video_url is null or video_url ~ '^https://'),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_user_image_path check (
    image_path is null or (owner_id is not null and image_path like owner_id::text || '/%')
  )
);
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();
create unique index exercises_slug_per_owner_idx
  on public.exercises (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
create index exercises_name_trgm_idx on public.exercises using gin (name extensions.gin_trgm_ops);

create table public.workout_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  split_type public.split_type not null default 'custom',
  description text check (description is null or char_length(description) <= 4000),
  is_active boolean not null default false,
  is_template boolean not null default false,
  source public.plan_source not null default 'manual',
  generation_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workout_programs_updated_at before update on public.workout_programs
  for each row execute function public.set_updated_at();
create index workout_programs_user_idx on public.workout_programs (user_id);
create unique index workout_programs_one_active_idx on public.workout_programs (user_id) where is_active;

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.workout_programs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null default 0,
  name text not null check (char_length(name) between 1 and 80),
  weekday smallint check (weekday is null or weekday between 1 and 7),
  is_rest_day boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger program_days_updated_at before update on public.program_days
  for each row execute function public.set_updated_at();
create index program_days_program_idx on public.program_days (program_id, position);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  sets smallint not null default 3 check (sets between 1 and 20),
  rep_min smallint not null default 8 check (rep_min between 1 and 100),
  rep_max smallint not null default 12 check (rep_max between 1 and 100),
  suggested_weight_kg numeric(6, 2) check (suggested_weight_kg is null or suggested_weight_kg between 0 and 1000),
  rest_seconds smallint not null default 90 check (rest_seconds between 0 and 900),
  tempo text check (tempo is null or tempo ~ '^[0-9xX]-?[0-9xX]-?[0-9xX]-?[0-9xX]$'),
  superset_group smallint check (superset_group is null or superset_group between 1 and 20),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_exercises_rep_range check (rep_max >= rep_min)
);
create trigger program_exercises_updated_at before update on public.program_exercises
  for each row execute function public.set_updated_at();
create index program_exercises_day_idx on public.program_exercises (program_day_id, position);

-- ---------------------------------------------------------------------------
-- Workout sessions and logged sets
-- ---------------------------------------------------------------------------
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid references public.workout_programs (id) on delete set null,
  program_day_id uuid references public.program_days (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  scheduled_for date,
  status public.session_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  completed_at timestamptz,
  feedback public.session_feedback,
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_completed_at check (status <> 'completed' or completed_at is not null),
  constraint workout_sessions_paused_at check (status <> 'paused' or paused_at is not null)
);
create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();
create index workout_sessions_user_idx on public.workout_sessions (user_id, started_at desc);
create unique index workout_sessions_one_open_idx
  on public.workout_sessions (user_id) where status in ('in_progress', 'paused');

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  program_exercise_id uuid references public.program_exercises (id) on delete set null,
  position integer not null default 0,
  rep_min smallint check (rep_min is null or rep_min between 1 and 100),
  rep_max smallint check (rep_max is null or rep_max between 1 and 100),
  rest_seconds smallint not null default 90 check (rest_seconds between 0 and 900),
  tempo text,
  superset_group smallint,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger session_exercises_updated_at before update on public.session_exercises
  for each row execute function public.set_updated_at();
create index session_exercises_session_idx on public.session_exercises (session_id, position);
create index session_exercises_user_exercise_idx on public.session_exercises (user_id, exercise_id);

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 50),
  target_reps smallint check (target_reps is null or target_reps between 1 and 100),
  target_weight_kg numeric(6, 2) check (target_weight_kg is null or target_weight_kg between 0 and 1000),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg between 0 and 1000),
  reps smallint check (reps is null or reps between 0 and 200),
  rir smallint check (rir is null or rir between 0 and 10),
  is_warmup boolean not null default false,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_exercise_id, set_number),
  constraint session_sets_completed_values check (
    not is_completed or (reps is not null and weight_kg is not null and completed_at is not null)
  )
);
create trigger session_sets_updated_at before update on public.session_sets
  for each row execute function public.set_updated_at();
create index session_sets_session_idx on public.session_sets (session_id);

-- ---------------------------------------------------------------------------
-- Progress
-- ---------------------------------------------------------------------------
create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) check (weight_kg is null or weight_kg between 30 and 350),
  waist_cm numeric(5, 1) check (waist_cm is null or waist_cm between 30 and 250),
  chest_cm numeric(5, 1) check (chest_cm is null or chest_cm between 30 and 250),
  hips_cm numeric(5, 1) check (hips_cm is null or hips_cm between 30 and 250),
  arm_cm numeric(5, 1) check (arm_cm is null or arm_cm between 10 and 100),
  thigh_cm numeric(5, 1) check (thigh_cm is null or thigh_cm between 20 and 150),
  body_fat_pct numeric(4, 1) check (body_fat_pct is null or body_fat_pct between 2 and 70),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, measured_on),
  constraint measurements_has_value check (
    coalesce(weight_kg, waist_cm, chest_cm, hips_cm, arm_cm, thigh_cm, body_fat_pct) is not null
  )
);
create trigger measurements_updated_at before update on public.measurements
  for each row execute function public.set_updated_at();

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_on date not null,
  pose text not null default 'front' check (pose in ('front', 'side', 'back', 'other')),
  storage_path text not null unique check (storage_path like user_id::text || '/%'),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index progress_photos_user_idx on public.progress_photos (user_id, taken_on desc);

-- ---------------------------------------------------------------------------
-- Shopping lists
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  meal_plan_id uuid references public.meal_plans (id) on delete set null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_lists_range check (
    (start_date is null and end_date is null)
    or (start_date is not null and end_date is not null and end_date >= start_date and end_date - start_date <= 27)
  )
);
create trigger shopping_lists_updated_at before update on public.shopping_lists
  for each row execute function public.set_updated_at();
create index shopping_lists_user_idx on public.shopping_lists (user_id, created_at desc);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  category public.grocery_category not null default 'other',
  preparation public.food_preparation,
  quantity numeric(10, 2) check (quantity is null or (quantity > 0 and quantity <= 100000)),
  unit text check (unit is null or unit in ('g', 'ml', 'st', 'förp')),
  is_purchased boolean not null default false,
  is_custom boolean not null default false,
  price_sek numeric(8, 2) check (price_sek is null or price_sek >= 0),
  position integer not null default 0,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shopping_list_items_updated_at before update on public.shopping_list_items
  for each row execute function public.set_updated_at();
create index shopping_list_items_list_idx on public.shopping_list_items (list_id, category, position);

-- ---------------------------------------------------------------------------
-- AI coach
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Ny konversation' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.chat_role not null,
  content text not null check (char_length(content) between 1 and 20000),
  meta jsonb,
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

-- Append-only request log used for per-user rate limiting of AI endpoints.
create table public.ai_request_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('coach', 'meal_plan', 'meal_regenerate', 'workout_plan', 'substitution')),
  created_at timestamptz not null default now()
);
create index ai_request_log_user_idx on public.ai_request_log (user_id, created_at desc);
