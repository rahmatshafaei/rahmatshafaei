import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

type Table = keyof Database["public"]["Tables"];

/** Tables exported for the signed-in user, with the column that identifies the owner. */
const TABLES: [Table, "user_id" | "owner_id" | "id"][] = [
  ["profiles", "id"],
  ["nutrition_targets", "user_id"],
  ["user_preferences", "user_id"],
  ["foods", "owner_id"],
  ["food_servings", "owner_id"],
  ["favorite_foods", "user_id"],
  ["diary_entries", "user_id"],
  ["water_logs", "user_id"],
  ["recipes", "user_id"],
  ["recipe_ingredients", "user_id"],
  ["meal_plans", "user_id"],
  ["planned_meals", "user_id"],
  ["planned_meal_ingredients", "user_id"],
  ["meal_consumptions", "user_id"],
  ["exercises", "owner_id"],
  ["workout_programs", "user_id"],
  ["program_days", "user_id"],
  ["program_exercises", "user_id"],
  ["workout_sessions", "user_id"],
  ["session_exercises", "user_id"],
  ["session_sets", "user_id"],
  ["measurements", "user_id"],
  ["progress_photos", "user_id"],
  ["shopping_lists", "user_id"],
  ["shopping_list_items", "user_id"],
  ["ai_conversations", "user_id"],
  ["ai_messages", "user_id"],
];

/**
 * Downloads all of the user's own data as JSON (right of access / data portability).
 * Photos are listed by storage path; the files themselves stay in private storage.
 */
export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Du måste vara inloggad." }, { status: 401 });

  // Untyped view of the same (RLS-bound) client so tables can be iterated generically.
  const db = auth.supabase as unknown as SupabaseClient;
  const data: Record<string, unknown[]> = {};
  for (const [table, column] of TABLES) {
    const rows: unknown[] = [];
    // PostgREST returns at most 1000 rows per request.
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await db.from(table).select("*").eq(column, auth.userId).range(from, from + 999);
      if (error) {
        console.error("[export]", table, error.message);
        return NextResponse.json({ error: "Exporten misslyckades. Försök igen." }, { status: 500 });
      }
      rows.push(...(page ?? []));
      if ((page ?? []).length < 1000) break;
    }
    data[table] = rows;
  }

  const body = JSON.stringify({ exported_at: new Date().toISOString(), email: auth.email, format: "formafit-export-v1", data }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="formafit-export-${todayIso()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
