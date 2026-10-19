import "server-only";
import type { AuthContext } from "@/lib/auth";
import { UserFacingError, unwrap } from "@/lib/actions";
import { addDays, daysBetween } from "@/lib/dates";
import { aggregateGroceries, type GrocerySourceItem } from "@/lib/grocery/aggregate";

/**
 * Builds a shopping list from every planned meal of a saved plan within [start, end].
 * Steps: collect planned ingredients → normalise identities → group compatible quantities
 * (same food identity, preparation and unit) → persist categorised items.
 */
export async function generateGroceryList(auth: AuthContext, input: { planId: string; startDate: string; endDate: string; name?: string }) {
  const plan = unwrap(
    await auth.supabase.from("meal_plans").select("id, name, start_date, num_days").eq("id", input.planId).eq("user_id", auth.userId).single(),
  );
  const planEnd = addDays(plan.start_date, plan.num_days - 1);
  const start = input.startDate < plan.start_date ? plan.start_date : input.startDate;
  const end = input.endDate > planEnd ? planEnd : input.endDate;
  if (start > end) throw new UserFacingError("Datumintervallet ligger utanför planen.");
  const fromIndex = daysBetween(plan.start_date, start);
  const toIndex = daysBetween(plan.start_date, end);

  const meals = unwrap(
    await auth.supabase
      .from("planned_meals")
      .select("id, planned_meal_ingredients(quantity_g, foods(id, name, canonical_name, category, preparation))")
      .eq("plan_id", plan.id)
      .eq("user_id", auth.userId)
      .gte("day_index", fromIndex)
      .lte("day_index", toIndex),
  );
  const sources: GrocerySourceItem[] = meals.flatMap((m) =>
    m.planned_meal_ingredients
      .filter((i) => i.foods)
      .map((i) => ({
        foodId: i.foods!.id,
        name: i.foods!.name,
        canonicalName: i.foods!.canonical_name,
        category: i.foods!.category,
        preparation: i.foods!.preparation,
        quantity: Number(i.quantity_g),
        unit: "g" as const,
      })),
  );
  if (!sources.length) throw new UserFacingError("Planen har inga ingredienser under de valda dagarna.");
  const items = aggregateGroceries(sources);

  const list = unwrap(
    await auth.supabase
      .from("shopping_lists")
      .insert({ user_id: auth.userId, name: input.name?.trim() || `Inköp – ${plan.name}`, meal_plan_id: plan.id, start_date: start, end_date: end })
      .select("id")
      .single(),
  );
  unwrap(
    await auth.supabase.from("shopping_list_items").insert(
      items.map((item, position) => ({
        list_id: list.id,
        user_id: auth.userId,
        food_id: item.foodIds[0] ?? null,
        name: item.name,
        category: item.category,
        preparation: item.preparation,
        quantity: item.quantity,
        unit: item.unit,
        position,
      })),
    ),
  );
  return { id: list.id, itemCount: items.length };
}
