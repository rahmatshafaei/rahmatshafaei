/**
 * Integration tests against a real Supabase stack (run `npm run db:start` first).
 * They exercise Row Level Security, storage policies and the transactional SQL functions
 * with two independent users.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type Client = SupabaseClient<Database>;

async function newUser(): Promise<{ client: Client; id: string }> {
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `it-${crypto.randomUUID()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: "Integration-Test-123" });
  if (error || !data.user || !data.session) throw new Error(`signUp failed: ${error?.message ?? "no session (email confirmation enabled?)"}`);
  return { client, id: data.user.id };
}

let a: { client: Client; id: string };
let b: { client: Client; id: string };
let starterFoodId: string;
let starterExerciseId: string;

beforeAll(async () => {
  if (!key) throw new Error("Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for integration tests (see .env.example).");
  [a, b] = await Promise.all([newUser(), newUser()]);
  const food = await a.client.from("foods").select("id").eq("name", "Havregryn").is("owner_id", null).single();
  starterFoodId = food.data!.id;
  const ex = await a.client.from("exercises").select("id").eq("slug", "bankpress").is("owner_id", null).single();
  starterExerciseId = ex.data!.id;
});

describe("profiles", () => {
  it("creates a profile and preferences row on signup", async () => {
    const { data } = await a.client.from("profiles").select("id").eq("id", a.id).single();
    expect(data?.id).toBe(a.id);
    const prefs = await a.client.from("user_preferences").select("water_goal_ml").eq("user_id", a.id).single();
    expect(prefs.data?.water_goal_ml).toBe(2500);
  });

  it("does not expose other users' profiles", async () => {
    const { data } = await b.client.from("profiles").select("id").eq("id", a.id);
    expect(data).toEqual([]);
  });
});

describe("foods ownership", () => {
  it("shares starter foods read-only", async () => {
    const { data } = await b.client.from("foods").select("id").eq("id", starterFoodId);
    expect(data).toHaveLength(1);
    const upd = await b.client.from("foods").update({ name: "Hack" }).eq("id", starterFoodId).select("id");
    expect(upd.data).toEqual([]);
    const ins = await b.client.from("foods").insert({ owner_id: null, name: "X", canonical_name: "x", source: "user", verification: "user_entered" });
    expect(ins.error).not.toBeNull();
  });

  it("keeps custom foods private", async () => {
    const created = await a.client
      .from("foods")
      .insert({ owner_id: a.id, name: "Min proteinbar", canonical_name: "min proteinbar", source: "user", verification: "user_entered", kcal_per_100g: 380, protein_per_100g: 30, carbs_per_100g: 35, fat_per_100g: 12 })
      .select("id")
      .single();
    expect(created.error).toBeNull();
    const seenByB = await b.client.from("foods").select("id").eq("id", created.data!.id);
    expect(seenByB.data).toEqual([]);
    // B cannot reference A's private food in their own diary.
    const diary = await b.client.from("diary_entries").insert({
      user_id: b.id,
      entry_date: "2026-10-19",
      meal_slot: "snack",
      food_id: created.data!.id,
      food_name: "stolen",
      quantity_g: 50,
      verification: "user_entered",
    });
    expect(diary.error).not.toBeNull();
  });

  it("rejects impossible nutrition values", async () => {
    const { error } = await a.client.from("foods").insert({
      owner_id: a.id,
      name: "Fel",
      canonical_name: "fel",
      source: "user",
      verification: "user_entered",
      protein_per_100g: 60,
      carbs_per_100g: 60,
      fat_per_100g: 10,
    });
    expect(error?.code).toBe("23514");
  });
});

describe("diary", () => {
  it("rejects invalid quantities and cross-user writes", async () => {
    const bad = await a.client.from("diary_entries").insert({ user_id: a.id, entry_date: "2026-10-19", meal_slot: "lunch", food_name: "X", quantity_g: 0, verification: "estimated" });
    expect(bad.error?.code).toBe("23514");
    const foreign = await b.client.from("diary_entries").insert({ user_id: a.id, entry_date: "2026-10-19", meal_slot: "lunch", food_name: "X", quantity_g: 10, verification: "estimated" });
    expect(foreign.error).not.toBeNull();
  });

  it("copies a day with copy_diary_entries", async () => {
    await a.client.from("diary_entries").insert([
      { user_id: a.id, entry_date: "2026-09-01", meal_slot: "breakfast", food_id: starterFoodId, food_name: "Havregryn", quantity_g: 60, kcal_per_100g: 367, verification: "estimated" },
      { user_id: a.id, entry_date: "2026-09-01", meal_slot: "dinner", food_id: starterFoodId, food_name: "Havregryn", quantity_g: 20, kcal_per_100g: 367, verification: "estimated" },
    ]);
    const { data: count } = await a.client.rpc("copy_diary_entries", { p_from: "2026-09-01", p_to: "2026-09-02", p_slot: "breakfast", p_target_slot: "snack" });
    expect(count).toBe(1);
    const { data } = await a.client.from("diary_entries").select("meal_slot, quantity_g").eq("entry_date", "2026-09-02");
    expect(data).toEqual([{ meal_slot: "snack", quantity_g: 60 }]);
    const { data: bCount } = await b.client.rpc("copy_diary_entries", { p_from: "2026-09-01", p_to: "2026-09-03" });
    expect(bCount).toBe(0);
  });
});

describe("meal plans", () => {
  let planId: string;
  let mealId: string;

  beforeAll(async () => {
    const { data, error } = await a.client.rpc("create_meal_plan", {
      p_plan: {
        name: "Testplan",
        start_date: "2026-10-20",
        num_days: 2,
        meals: [{ day_index: 0, name: "Gröt", meal_slot: "breakfast", ingredients: [{ food_id: starterFoodId, quantity_g: 80 }] }],
      },
    });
    expect(error).toBeNull();
    planId = data!;
    const meal = await a.client.from("planned_meals").select("id").eq("plan_id", planId).single();
    mealId = meal.data!.id;
  });

  it("marks a planned meal as eaten idempotently", async () => {
    const first = await a.client.rpc("mark_planned_meal_eaten", { p_planned_meal_id: mealId, p_date: "2026-10-20" });
    const second = await a.client.rpc("mark_planned_meal_eaten", { p_planned_meal_id: mealId, p_date: "2026-10-20" });
    expect(first.error).toBeNull();
    expect(first.data?.[0].created).toBe(true);
    expect(second.data?.[0].created).toBe(false);
    expect(second.data?.[0].consumption_id).toBe(first.data?.[0].consumption_id);
    const { data: entries } = await a.client.from("diary_entries").select("quantity_g, kcal_per_100g").eq("consumption_id", first.data![0].consumption_id);
    expect(entries).toEqual([{ quantity_g: 80, kcal_per_100g: 367 }]);
  });

  it("does not change history when the plan is edited or deleted later", async () => {
    await a.client.from("planned_meal_ingredients").update({ quantity_g: 200 }).eq("planned_meal_id", mealId);
    const { data: before } = await a.client.from("diary_entries").select("quantity_g").eq("entry_date", "2026-10-20").eq("user_id", a.id);
    expect(before).toEqual([{ quantity_g: 80 }]);
  });

  it("undoes a consumption explicitly", async () => {
    const { data } = await a.client.rpc("mark_planned_meal_eaten", { p_planned_meal_id: mealId, p_date: "2026-10-21" });
    const cid = data![0].consumption_id;
    await a.client.rpc("undo_meal_consumption", { p_consumption_id: cid });
    const { data: rest } = await a.client.from("diary_entries").select("id").eq("consumption_id", cid);
    expect(rest).toEqual([]);
  });

  it("isolates plans between users", async () => {
    const read = await b.client.from("meal_plans").select("id").eq("id", planId);
    expect(read.data).toEqual([]);
    const intrude = await b.client.from("planned_meals").insert({ plan_id: planId, user_id: b.id, day_index: 0, name: "Intrång" });
    expect(intrude.error).not.toBeNull();
    const eat = await b.client.rpc("mark_planned_meal_eaten", { p_planned_meal_id: mealId, p_date: "2026-10-20" });
    expect(eat.error).not.toBeNull();
    const del = await b.client.from("meal_plans").delete().eq("id", planId).select("id");
    expect(del.data).toEqual([]);
  });

  it("copies and duplicates plan days and meals", async () => {
    const { data: copied } = await a.client.rpc("copy_plan_day", { p_plan_id: planId, p_from_day: 0, p_to_day: 1, p_replace: false });
    expect(copied).toBe(1);
    const { data: dup } = await a.client.rpc("duplicate_planned_meal", { p_meal_id: mealId });
    expect(dup).toBeTruthy();
    const { data: meals } = await a.client.from("planned_meals").select("day_index").eq("plan_id", planId).order("day_index");
    expect(meals?.map((m) => m.day_index)).toEqual([0, 0, 1]);
    const outOfRange = await a.client.rpc("copy_plan_day", { p_plan_id: planId, p_from_day: 0, p_to_day: 5, p_replace: false });
    expect(outOfRange.error).not.toBeNull();
  });
});

describe("workouts", () => {
  let dayId: string;

  beforeAll(async () => {
    const { data, error } = await a.client.rpc("create_workout_program", {
      p_program: {
        name: "Push",
        split_type: "push_pull_legs",
        days: [
          { position: 0, name: "Push A", weekday: 1, exercises: [{ exercise_id: starterExerciseId, sets: 3, rep_min: 6, rep_max: 8, suggested_weight_kg: 60 }] },
          { position: 1, name: "Vila", is_rest_day: true },
        ],
      },
    });
    expect(error).toBeNull();
    const day = await a.client.from("program_days").select("id").eq("program_id", data!).eq("is_rest_day", false).single();
    dayId = day.data!.id;
  });

  it("starts a session with pending sets and allows only one open session", async () => {
    const { data: sessionId, error } = await a.client.rpc("start_workout_session", { p_program_day_id: dayId });
    expect(error).toBeNull();
    const { data: sets } = await a.client.from("session_sets").select("set_number, target_reps, target_weight_kg").eq("session_id", sessionId!).order("set_number");
    expect(sets).toEqual([
      { set_number: 1, target_reps: 8, target_weight_kg: 60 },
      { set_number: 2, target_reps: 8, target_weight_kg: 60 },
      { set_number: 3, target_reps: 8, target_weight_kg: 60 },
    ]);
    const second = await a.client.rpc("start_workout_session", { p_program_day_id: dayId });
    expect(second.error?.code).toBe("23505");

    // A session cannot be completed without completed sets.
    const early = await a.client.rpc("complete_workout_session", { p_session_id: sessionId! });
    expect(early.error).not.toBeNull();

    // A completed set requires weight and reps.
    const invalid = await a.client.from("session_sets").update({ is_completed: true, completed_at: new Date().toISOString() }).eq("session_id", sessionId!).eq("set_number", 1);
    expect(invalid.error?.code).toBe("23514");
    await a.client.from("session_sets").update({ weight_kg: 60, reps: 8, is_completed: true, completed_at: new Date().toISOString() }).eq("session_id", sessionId!).eq("set_number", 1);

    // Other users cannot log sets in this session.
    const foreign = await b.client.from("session_sets").update({ reps: 99 }).eq("session_id", sessionId!).select("id");
    expect(foreign.data).toEqual([]);
    const foreignComplete = await b.client.rpc("complete_workout_session", { p_session_id: sessionId! });
    expect(foreignComplete.error).not.toBeNull();

    const done = await a.client.rpc("complete_workout_session", { p_session_id: sessionId!, p_feedback: "just_right" });
    expect(done.error).toBeNull();
    const { data: session } = await a.client.from("workout_sessions").select("status, completed_at").eq("id", sessionId!).single();
    expect(session?.status).toBe("completed");
    expect(session?.completed_at).not.toBeNull();
  });

  it("refuses to start a rest day", async () => {
    const { data: rest } = await a.client.from("program_days").select("id").eq("is_rest_day", true).single();
    const res = await a.client.rpc("start_workout_session", { p_program_day_id: rest!.id });
    expect(res.error).not.toBeNull();
  });
});

describe("AI rate limiting", () => {
  it("enforces the per-user quota and cannot be reset by the user", async () => {
    const results = [];
    for (let i = 0; i < 3; i++) {
      const { data } = await b.client.rpc("consume_ai_quota", { p_kind: "coach", p_limit: 2, p_window_minutes: 60 });
      results.push(data);
    }
    expect(results).toEqual([true, true, false]);
    const del = await b.client.from("ai_request_log").delete().eq("user_id", b.id).select("id");
    expect(del.data ?? []).toEqual([]);
    const { data: again } = await b.client.rpc("consume_ai_quota", { p_kind: "coach", p_limit: 2, p_window_minutes: 60 });
    expect(again).toBe(false);
    // Quotas are per user.
    const { data: other } = await a.client.rpc("consume_ai_quota", { p_kind: "coach", p_limit: 2, p_window_minutes: 60 });
    expect(other).toBe(true);
  });
});

describe("storage policies", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it("only allows uploads into the user's own folder and keeps photos private", async () => {
    const own = await a.client.storage.from("progress-photos").upload(`${a.id}/test.png`, png, { contentType: "image/png" });
    expect(own.error).toBeNull();
    const intoOther = await b.client.storage.from("progress-photos").upload(`${a.id}/evil.png`, png, { contentType: "image/png" });
    expect(intoOther.error).not.toBeNull();
    const readOther = await b.client.storage.from("progress-photos").download(`${a.id}/test.png`);
    expect(readOther.error).not.toBeNull();
    const signedByOther = await b.client.storage.from("progress-photos").createSignedUrl(`${a.id}/test.png`, 60);
    expect(signedByOther.data).toBeNull();
  });

  it("rejects disallowed file types", async () => {
    const res = await a.client.storage.from("user-media").upload(`${a.id}/x.svg`, new TextEncoder().encode("<svg/>"), { contentType: "image/svg+xml" });
    expect(res.error).not.toBeNull();
  });
});
