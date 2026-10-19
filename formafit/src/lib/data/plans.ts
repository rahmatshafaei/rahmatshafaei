import "server-only";
import type { AuthContext } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { getFoodsByIds } from "@/lib/data/foods";
import { mealTotals, toPer100g, type NutrientTotals } from "@/lib/nutrition/engine";
import { signedUrls } from "@/lib/services/storage";
import type { FoodSummary, MealSlot } from "@/lib/types";

export interface PlanIngredient {
  id: string;
  quantityG: number;
  position: number;
  note: string | null;
  food: FoodSummary;
}

export interface PlanMeal {
  id: string;
  dayIndex: number;
  position: number;
  name: string;
  slot: MealSlot;
  time: string | null;
  instructions: string | null;
  prepMinutes: number | null;
  notes: string | null;
  imageUrl: string | null;
  ingredients: PlanIngredient[];
  totals: NutrientTotals;
}

export async function getPlanDetail(auth: AuthContext, planId: string) {
  const { data: plan, error } = await auth.supabase
    .from("meal_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) throw error;
  if (!plan) return null;
  const { data: meals, error: mealsError } = await auth.supabase
    .from("planned_meals")
    .select("*, planned_meal_ingredients(id, food_id, quantity_g, position, note)")
    .eq("plan_id", planId)
    .order("day_index")
    .order("position");
  if (mealsError) throw mealsError;
  const foodIds = (meals ?? []).flatMap((m) => m.planned_meal_ingredients.map((i) => i.food_id));
  const [foods, urls] = await Promise.all([
    getFoodsByIds(auth, foodIds),
    signedUrls(auth, "user-media", (meals ?? []).map((m) => m.image_path)),
  ]);
  const byId = new Map(foods.map((f) => [f.id, f]));
  const result: PlanMeal[] = (meals ?? []).map((m) => {
    const ingredients = m.planned_meal_ingredients
      .filter((i) => byId.has(i.food_id))
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, quantityG: Number(i.quantity_g), position: i.position, note: i.note, food: byId.get(i.food_id)! }));
    return {
      id: m.id,
      dayIndex: m.day_index,
      position: m.position,
      name: m.name,
      slot: m.meal_slot,
      time: m.meal_time ? m.meal_time.slice(0, 5) : null,
      instructions: m.instructions,
      prepMinutes: m.prep_minutes,
      notes: m.notes,
      imageUrl: m.image_path ? (urls.get(m.image_path) ?? null) : null,
      ingredients,
      totals: mealTotals(ingredients.map((i) => ({ per100: toPer100g(i.food), quantityG: i.quantityG }))),
    };
  });

  const consumptions = result.length
    ? (
        await auth.supabase
          .from("meal_consumptions")
          .select("id, planned_meal_id, consumed_on")
          .eq("user_id", auth.userId)
          .in("planned_meal_id", result.map((m) => m.id))
      ).data ?? []
    : [];

  return {
    plan: { ...plan, endDate: addDays(plan.start_date, plan.num_days - 1) },
    meals: result,
    consumptions: consumptions.map((c) => ({ id: c.id, mealId: c.planned_meal_id!, date: c.consumed_on })),
  };
}

export type PlanDetail = NonNullable<Awaited<ReturnType<typeof getPlanDetail>>>;
