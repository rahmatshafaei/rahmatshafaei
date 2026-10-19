import "server-only";
import type { AuthContext } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { dailyTotals, mealTotals, toPer100g, type NutrientTotals } from "@/lib/nutrition/engine";
import type { Tables } from "@/lib/supabase/database.types";

export type DiaryEntry = Tables<"diary_entries">;

export function entryTotals(e: DiaryEntry): NutrientTotals {
  return mealTotals([{ per100: toPer100g(e), quantityG: Number(e.quantity_g) }]);
}

export async function getDiaryDay(auth: AuthContext, date: string) {
  const [entries, water] = await Promise.all([
    auth.supabase
      .from("diary_entries")
      .select("*")
      .eq("user_id", auth.userId)
      .eq("entry_date", date)
      .order("meal_slot")
      .order("position")
      .order("created_at"),
    auth.supabase.from("water_logs").select("*").eq("user_id", auth.userId).eq("log_date", date).order("created_at"),
  ]);
  if (entries.error) throw entries.error;
  if (water.error) throw water.error;
  const rows = entries.data ?? [];
  const totals = dailyTotals(rows.map((e) => ({ slot: e.meal_slot, per100: toPer100g(e), quantityG: Number(e.quantity_g) })));
  return {
    entries: rows.map((e) => ({ ...e, totals: entryTotals(e) })),
    totals,
    water: water.data ?? [],
    waterMl: (water.data ?? []).reduce((s, w) => s + w.amount_ml, 0),
  };
}

/** Daily intake totals for a range, from persisted diary entries only. */
export async function getIntakeRange(auth: AuthContext, from: string, to: string) {
  const { data, error } = await auth.supabase
    .from("diary_entries")
    .select("entry_date, quantity_g, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .eq("user_id", auth.userId)
    .gte("entry_date", from)
    .lte("entry_date", to);
  if (error) throw error;
  const byDay = new Map<string, NutrientTotals[]>();
  for (const row of data ?? []) {
    const t = mealTotals([{ per100: toPer100g(row), quantityG: Number(row.quantity_g) }]);
    byDay.set(row.entry_date, [...(byDay.get(row.entry_date) ?? []), t]);
  }
  const days: { date: string; kcal: number; protein: number; carbs: number; fat: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const items = byDay.get(d) ?? [];
    days.push({
      date: d,
      kcal: items.reduce((s, t) => s + t.kcal, 0),
      protein: items.reduce((s, t) => s + t.protein, 0),
      carbs: items.reduce((s, t) => s + t.carbs, 0),
      fat: items.reduce((s, t) => s + t.fat, 0),
    });
  }
  return days;
}

/** Planned meals scheduled for a date across the user's (non-archived) plans. */
export async function getPlannedMealsForDate(auth: AuthContext, date: string) {
  const { data: plans, error } = await auth.supabase
    .from("meal_plans")
    .select("id, name, start_date, num_days")
    .eq("user_id", auth.userId)
    .is("archived_at", null)
    .lte("start_date", date);
  if (error) throw error;
  const active = (plans ?? []).filter((p) => addDays(p.start_date, p.num_days - 1) >= date);
  if (!active.length) return [];
  const pairs = active.map((p) => ({ plan: p, dayIndex: Math.round((Date.parse(date) - Date.parse(p.start_date)) / 86_400_000) }));
  const results = await Promise.all(
    pairs.map(async ({ plan, dayIndex }) => {
      const { data: meals, error: mealsError } = await auth.supabase
        .from("planned_meals")
        .select("id, name, meal_slot, meal_time, position, planned_meal_ingredients(quantity_g, foods(kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g))")
        .eq("plan_id", plan.id)
        .eq("day_index", dayIndex)
        .order("position");
      if (mealsError) throw mealsError;
      return (meals ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        slot: m.meal_slot,
        time: m.meal_time,
        planName: plan.name,
        planId: plan.id,
        totals: mealTotals(
          m.planned_meal_ingredients
            .filter((i) => i.foods)
            .map((i) => ({ per100: toPer100g(i.foods!), quantityG: Number(i.quantity_g) })),
        ),
      }));
    }),
  );
  const meals = results.flat();
  if (!meals.length) return [];
  const { data: consumptions } = await auth.supabase
    .from("meal_consumptions")
    .select("id, planned_meal_id")
    .eq("user_id", auth.userId)
    .eq("consumed_on", date)
    .in("planned_meal_id", meals.map((m) => m.id));
  const consumed = new Map((consumptions ?? []).map((c) => [c.planned_meal_id, c.id]));
  return meals.map((m) => ({ ...m, consumptionId: consumed.get(m.id) ?? null }));
}
