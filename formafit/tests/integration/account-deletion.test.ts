/**
 * Account deletion must remove every private row of the user (including rows that reference
 * the user's own custom foods and exercises) and leave other users untouched.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const PASSWORD = "Integration-Test-123";

async function newUser() {
  const client: SupabaseClient<Database> = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `del-${crypto.randomUUID()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error || !data.user) throw error ?? new Error("signUp failed");
  return { client, id: data.user.id, email };
}

describe("delete_my_account", () => {
  it("removes all of the user's data, including references to their own foods and exercises", async () => {
    const [victim, other] = await Promise.all([newUser(), newUser()]);
    const c = victim.client;

    const food = (await c.from("foods").insert({ owner_id: victim.id, name: "Egen mat", canonical_name: "egen mat", source: "user", verification: "user_entered", kcal_per_100g: 100, protein_per_100g: 10, carbs_per_100g: 10, fat_per_100g: 2 }).select("id").single()).data!;
    const recipe = (await c.from("recipes").insert({ user_id: victim.id, name: "Recept" }).select("id").single()).data!;
    expect((await c.from("recipe_ingredients").insert({ recipe_id: recipe.id, user_id: victim.id, food_id: food.id, quantity_g: 100 })).error).toBeNull();
    const planId = (await c.rpc("create_meal_plan", { p_plan: { name: "P", start_date: "2026-10-20", num_days: 1, meals: [{ day_index: 0, name: "M", ingredients: [{ food_id: food.id, quantity_g: 50 }] }] } })).data!;
    const mealId = (await c.from("planned_meals").select("id").eq("plan_id", planId).single()).data!.id;
    expect((await c.rpc("mark_planned_meal_eaten", { p_planned_meal_id: mealId, p_date: "2026-10-20" })).error).toBeNull();

    const exercise = (await c.from("exercises").insert({ owner_id: victim.id, slug: `egen-${crypto.randomUUID().slice(0, 6)}`, name: "Egen övning", primary_muscles: ["chest"], equipment: "dumbbell" }).select("id").single()).data!;
    const programId = (await c.rpc("create_workout_program", { p_program: { name: "Prog", days: [{ name: "A", exercises: [{ exercise_id: exercise.id, sets: 1 }] }] } })).data!;
    const dayId = (await c.from("program_days").select("id").eq("program_id", programId).single()).data!.id;
    const sessionId = (await c.rpc("start_workout_session", { p_program_day_id: dayId })).data!;
    expect(sessionId).toBeTruthy();
    await c.from("measurements").insert({ user_id: victim.id, measured_on: "2026-10-19", weight_kg: 80 });
    const conv = (await c.from("ai_conversations").insert({ user_id: victim.id, title: "Hej" }).select("id").single()).data!;
    await c.from("ai_messages").insert({ conversation_id: conv.id, user_id: victim.id, role: "user", content: "Hej" });

    await other.client.from("measurements").insert({ user_id: other.id, measured_on: "2026-10-19", weight_kg: 70 });

    const { error } = await c.rpc("delete_my_account");
    expect(error).toBeNull();

    // The user can no longer sign in.
    const fresh = createClient<Database>(url, key, { auth: { persistSession: false } });
    const login = await fresh.auth.signInWithPassword({ email: victim.email, password: PASSWORD });
    expect(login.error).not.toBeNull();

    // With the service-role key (test tooling only) verify that no private row survived.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
      const tables = [
        "profiles", "nutrition_targets", "user_preferences", "diary_entries", "water_logs", "recipes", "recipe_ingredients",
        "meal_plans", "planned_meals", "planned_meal_ingredients", "meal_consumptions", "workout_programs", "program_days",
        "program_exercises", "workout_sessions", "session_exercises", "session_sets", "measurements", "ai_conversations",
        "ai_messages", "ai_request_log", "favorite_foods",
      ] as const;
      for (const table of tables) {
        const column = table === "profiles" ? "id" : "user_id";
        const { count, error: countError } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, victim.id);
        expect(countError, table).toBeNull();
        expect(count, table).toBe(0);
      }
      for (const table of ["foods", "exercises"] as const) {
        const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq("owner_id", victim.id);
        expect(count, table).toBe(0);
      }
    }

    // Shared starter data and other users are untouched.
    const { data: starter } = await other.client.from("foods").select("id").is("owner_id", null).limit(1);
    expect(starter).toHaveLength(1);
    const { data: otherRows } = await other.client.from("measurements").select("weight_kg").eq("user_id", other.id);
    expect(otherRows).toEqual([{ weight_kg: 70 }]);
  });

  it("requires a signed-in user", async () => {
    const anon = createClient<Database>(url, key, { auth: { persistSession: false } });
    const { error } = await anon.rpc("delete_my_account");
    expect(error).not.toBeNull();
  });
});
