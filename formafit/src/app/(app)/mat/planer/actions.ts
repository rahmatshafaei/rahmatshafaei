"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction, unwrap, UserFacingError } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { FOOD_COLUMNS, summarizeFoods } from "@/lib/data/foods";
import { MEAL_SLOT_LABELS } from "@/lib/labels";
import { scalePortionsToCalories, toPer100g } from "@/lib/nutrition/engine";
import { rankSubstitutes } from "@/lib/nutrition/substitutes";
import { grams, isoDate, mealPlanCreateSchema, mealSlot, plannedMealUpdateSchema, uuid } from "@/lib/validation";

function revalidatePlan(planId?: string) {
  if (planId) revalidatePath(`/mat/planer/${planId}`);
  revalidatePath("/mat/planer");
  revalidatePath("/mat");
}

async function mealPlanId(auth: AuthContext, mealId: string) {
  const meal = unwrap(
    await auth.supabase.from("planned_meals").select("id, plan_id, day_index").eq("id", mealId).eq("user_id", auth.userId).single(),
  );
  return meal;
}

async function ingredientMeal(auth: AuthContext, ingredientId: string) {
  return unwrap(
    await auth.supabase
      .from("planned_meal_ingredients")
      .select("id, food_id, quantity_g, planned_meal_id, planned_meals(plan_id)")
      .eq("id", ingredientId)
      .eq("user_id", auth.userId)
      .single(),
  );
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function createPlan(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = mealPlanCreateSchema.parse(raw);
    const plan = unwrap(
      await supabase
        .from("meal_plans")
        .insert({ user_id: userId, name: input.name, start_date: input.startDate, num_days: input.numDays })
        .select("id")
        .single(),
    );
    revalidatePlan();
    return { id: plan.id };
  });
}

const planUpdateSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(120),
  startDate: isoDate,
  numDays: z.coerce.number().int().min(1).max(28),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export async function updatePlan(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = planUpdateSchema.parse(raw);
    const { data: maxDay } = await supabase
      .from("planned_meals")
      .select("day_index")
      .eq("plan_id", input.id)
      .order("day_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxDay && maxDay.day_index >= input.numDays) {
      throw new UserFacingError(`Planen har måltider på dag ${maxDay.day_index + 1}. Ta bort dem innan du kortar planen.`);
    }
    const rows = unwrap(
      await supabase
        .from("meal_plans")
        .update({ name: input.name, start_date: input.startDate, num_days: input.numDays, notes: input.notes ?? null })
        .eq("id", input.id)
        .eq("user_id", userId)
        .select("id"),
    );
    if (!rows.length) throw new UserFacingError("Planen hittades inte.");
    revalidatePlan(input.id);
    return null;
  });
}

export async function deletePlan(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    // Diary entries created from this plan are kept (consumption links are set to null).
    unwrap(await supabase.from("meal_plans").delete().eq("id", id).eq("user_id", userId));
    revalidatePlan();
    return null;
  });
}

export async function duplicatePlan(raw: unknown) {
  return authedAction(async ({ supabase }) => {
    const input = z.object({ id: uuid, name: z.string().trim().min(1).max(120), startDate: isoDate }).parse(raw);
    const id = unwrap(await supabase.rpc("duplicate_meal_plan", { p_plan_id: input.id, p_name: input.name, p_start_date: input.startDate }));
    revalidatePlan();
    return { id };
  });
}

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

const addMealSchema = z.object({
  planId: uuid,
  dayIndex: z.coerce.number().int().min(0).max(27),
  slot: mealSlot,
  name: z.string().trim().max(120).optional(),
  fromRecipeId: uuid.nullable().optional(),
});

export async function addMeal(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = addMealSchema.parse(raw);
    const plan = unwrap(await supabase.from("meal_plans").select("id, num_days").eq("id", input.planId).eq("user_id", userId).single());
    if (input.dayIndex >= plan.num_days) throw new UserFacingError("Dagen finns inte i planen.");
    const { count } = await supabase
      .from("planned_meals")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", input.planId)
      .eq("day_index", input.dayIndex);

    let recipe: { name: string; instructions: string | null; prep_minutes: number | null; servings: number; recipe_ingredients: { food_id: string; quantity_g: number; position: number }[] } | null = null;
    if (input.fromRecipeId) {
      recipe = unwrap(
        await supabase
          .from("recipes")
          .select("name, instructions, prep_minutes, servings, recipe_ingredients(food_id, quantity_g, position)")
          .eq("id", input.fromRecipeId)
          .eq("user_id", userId)
          .single(),
      );
    }

    const meal = unwrap(
      await supabase
        .from("planned_meals")
        .insert({
          plan_id: input.planId,
          user_id: userId,
          day_index: input.dayIndex,
          position: count ?? 0,
          name: input.name || recipe?.name || MEAL_SLOT_LABELS[input.slot],
          meal_slot: input.slot,
          instructions: recipe?.instructions ?? null,
          prep_minutes: recipe?.prep_minutes ?? null,
          source_recipe_id: input.fromRecipeId ?? null,
        })
        .select("id")
        .single(),
    );
    if (recipe?.recipe_ingredients.length) {
      // One portion of the recipe.
      const factor = 1 / Number(recipe.servings);
      unwrap(
        await supabase.from("planned_meal_ingredients").insert(
          recipe.recipe_ingredients.map((i) => ({
            planned_meal_id: meal.id,
            user_id: userId,
            food_id: i.food_id,
            quantity_g: Math.max(1, Math.round(Number(i.quantity_g) * factor)),
            position: i.position,
          })),
        ),
      );
    }
    revalidatePlan(input.planId);
    return { id: meal.id };
  });
}

export async function updateMeal(raw: unknown) {
  return authedAction(async (auth) => {
    const input = plannedMealUpdateSchema.parse(raw);
    const meal = await mealPlanId(auth, input.id);
    unwrap(
      await auth.supabase
        .from("planned_meals")
        .update({
          name: input.name,
          meal_slot: input.mealSlot,
          meal_time: input.mealTime ?? null,
          instructions: input.instructions ?? null,
          prep_minutes: input.prepMinutes ?? null,
          notes: input.notes ?? null,
        })
        .eq("id", input.id)
        .eq("user_id", auth.userId),
    );
    revalidatePlan(meal.plan_id);
    return null;
  });
}

export async function deleteMeal(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const meal = await mealPlanId(auth, id);
    unwrap(await auth.supabase.from("planned_meals").delete().eq("id", id).eq("user_id", auth.userId));
    revalidatePlan(meal.plan_id);
    return null;
  });
}

export async function duplicateMeal(rawId: unknown, rawTargetDay?: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const targetDay = rawTargetDay === undefined || rawTargetDay === null ? null : z.coerce.number().int().min(0).max(27).parse(rawTargetDay);
    const meal = await mealPlanId(auth, id);
    const newId = unwrap(await auth.supabase.rpc("duplicate_planned_meal", { p_meal_id: id, p_target_day: targetDay ?? undefined }));
    revalidatePlan(meal.plan_id);
    return { id: newId };
  });
}

export async function reorderMeals(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = z.object({ planId: uuid, dayIndex: z.number().int().min(0).max(27), orderedIds: z.array(uuid).max(50) }).parse(raw);
    const existing = unwrap(
      await supabase.from("planned_meals").select("id").eq("plan_id", input.planId).eq("day_index", input.dayIndex).eq("user_id", userId),
    );
    const ids = new Set(existing.map((m) => m.id));
    if (input.orderedIds.length !== ids.size || input.orderedIds.some((id) => !ids.has(id))) {
      throw new UserFacingError("Måltiderna har ändrats. Ladda om sidan.");
    }
    await Promise.all(
      input.orderedIds.map((id, position) => supabase.from("planned_meals").update({ position }).eq("id", id).eq("user_id", userId)),
    );
    revalidatePlan(input.planId);
    return null;
  });
}

export async function copyPlanDay(raw: unknown) {
  return authedAction(async ({ supabase }) => {
    const input = z
      .object({ planId: uuid, fromDay: z.number().int().min(0).max(27), toDay: z.number().int().min(0).max(27), replace: z.boolean() })
      .parse(raw);
    const count = unwrap(
      await supabase.rpc("copy_plan_day", { p_plan_id: input.planId, p_from_day: input.fromDay, p_to_day: input.toDay, p_replace: input.replace }),
    );
    revalidatePlan(input.planId);
    return { count };
  });
}

export async function saveMealAsTemplate(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = z.object({ mealId: uuid, name: z.string().trim().min(1, "Ange ett namn.").max(120) }).parse(raw);
    const meal = unwrap(
      await supabase
        .from("planned_meals")
        .select("meal_slot, instructions, prep_minutes, notes, planned_meal_ingredients(food_id, quantity_g, position)")
        .eq("id", input.mealId)
        .eq("user_id", userId)
        .single(),
    );
    if (!meal.planned_meal_ingredients.length) throw new UserFacingError("Måltiden har inga ingredienser.");
    const recipe = unwrap(
      await supabase
        .from("recipes")
        .insert({
          user_id: userId,
          kind: "meal",
          name: input.name,
          servings: 1,
          instructions: meal.instructions,
          prep_minutes: meal.prep_minutes,
          notes: meal.notes,
          default_slot: meal.meal_slot,
        })
        .select("id")
        .single(),
    );
    unwrap(
      await supabase.from("recipe_ingredients").insert(
        meal.planned_meal_ingredients.map((i) => ({ recipe_id: recipe.id, user_id: userId, food_id: i.food_id, quantity_g: i.quantity_g, position: i.position })),
      ),
    );
    revalidatePath("/mat/recept");
    return { id: recipe.id };
  });
}

// ---------------------------------------------------------------------------
// Ingredients
// ---------------------------------------------------------------------------

export async function addIngredient(raw: unknown) {
  return authedAction(async (auth) => {
    const input = z.object({ mealId: uuid, foodId: uuid, quantityG: grams }).parse(raw);
    const meal = await mealPlanId(auth, input.mealId);
    const { count } = await auth.supabase
      .from("planned_meal_ingredients")
      .select("id", { count: "exact", head: true })
      .eq("planned_meal_id", input.mealId);
    unwrap(
      await auth.supabase.from("planned_meal_ingredients").insert({
        planned_meal_id: input.mealId,
        user_id: auth.userId,
        food_id: input.foodId,
        quantity_g: input.quantityG,
        position: count ?? 0,
      }),
    );
    revalidatePlan(meal.plan_id);
    return null;
  });
}

export async function updateIngredient(raw: unknown) {
  return authedAction(async (auth) => {
    const input = z.object({ id: uuid, quantityG: grams }).parse(raw);
    const ing = await ingredientMeal(auth, input.id);
    unwrap(await auth.supabase.from("planned_meal_ingredients").update({ quantity_g: input.quantityG }).eq("id", input.id).eq("user_id", auth.userId));
    revalidatePlan(ing.planned_meals?.plan_id);
    return null;
  });
}

export async function removeIngredient(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const ing = await ingredientMeal(auth, id);
    unwrap(await auth.supabase.from("planned_meal_ingredients").delete().eq("id", id).eq("user_id", auth.userId));
    revalidatePlan(ing.planned_meals?.plan_id);
    return null;
  });
}

export async function replaceIngredient(raw: unknown) {
  return authedAction(async (auth) => {
    const input = z.object({ id: uuid, foodId: uuid, quantityG: grams }).parse(raw);
    const ing = await ingredientMeal(auth, input.id);
    // Ensure the replacement is visible to this user (RLS) before writing.
    unwrap(await auth.supabase.from("foods").select("id").eq("id", input.foodId).single());
    unwrap(
      await auth.supabase
        .from("planned_meal_ingredients")
        .update({ food_id: input.foodId, quantity_g: input.quantityG })
        .eq("id", input.id)
        .eq("user_id", auth.userId),
    );
    revalidatePlan(ing.planned_meals?.plan_id);
    return null;
  });
}

async function substitutesFor(auth: AuthContext, foodId: string, quantityG: number) {
  const [{ data: profile }, originalRows, candidateRows] = await Promise.all([
    auth.supabase.from("profiles").select("allergies, diet_preferences").eq("id", auth.userId).single(),
    auth.supabase.from("foods").select(FOOD_COLUMNS).eq("id", foodId).single(),
    auth.supabase.from("foods").select(FOOD_COLUMNS).eq("is_archived", false).limit(400),
  ]);
  if (originalRows.error) throw originalRows.error;
  const [original] = await summarizeFoods(auth, [originalRows.data]);
  const candidates = await summarizeFoods(auth, candidateRows.data ?? []);
  const options = rankSubstitutes(original, quantityG, candidates, {
    allergies: profile?.allergies ?? [],
    dietPreferences: profile?.diet_preferences ?? [],
    limit: 8,
  });
  return { original, quantityG, options };
}

/** Deterministic substitute suggestions for a saved planned ingredient. */
export async function getSubstitutes(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const ing = await ingredientMeal(auth, id);
    return substitutesFor(auth, ing.food_id, Number(ing.quantity_g));
  });
}

/** Deterministic substitute suggestions for an unsaved draft ingredient. */
export async function getSubstitutesForFood(rawFoodId: unknown, rawGrams: unknown) {
  return authedAction(async (auth) => substitutesFor(auth, uuid.parse(rawFoodId), grams.parse(rawGrams)));
}

/**
 * Scales all ingredients of a plan day so the day's energy matches the calorie target.
 * Changes multiple records, so the UI requires explicit confirmation first.
 */
export async function scaleDayToTarget(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = z.object({ planId: uuid, dayIndex: z.number().int().min(0).max(27) }).parse(raw);
    const { data: targets } = await supabase.from("nutrition_targets").select("calories").eq("user_id", userId).maybeSingle();
    if (!targets) throw new UserFacingError("Ange ett kalorimål i profilen först.");
    const meals = unwrap(
      await supabase
        .from("planned_meals")
        .select("id, planned_meal_ingredients(id, quantity_g, foods(kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g))")
        .eq("plan_id", input.planId)
        .eq("day_index", input.dayIndex)
        .eq("user_id", userId),
    );
    const ingredients = meals.flatMap((m) => m.planned_meal_ingredients).filter((i) => i.foods);
    if (!ingredients.length) throw new UserFacingError("Dagen har inga ingredienser att justera.");
    const scaled = scalePortionsToCalories(
      ingredients.map((i) => ({ per100: toPer100g(i.foods!), quantityG: Number(i.quantity_g) })),
      targets.calories,
    );
    await Promise.all(
      ingredients.map((ing, idx) =>
        supabase.from("planned_meal_ingredients").update({ quantity_g: scaled.portions[idx].quantityG }).eq("id", ing.id).eq("user_id", userId),
      ),
    );
    revalidatePlan(input.planId);
    return { factor: scaled.factor, kcal: scaled.totals.kcal };
  });
}

// ---------------------------------------------------------------------------
// Grocery list from plan
// ---------------------------------------------------------------------------

export async function planDateRange(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    const plan = unwrap(await supabase.from("meal_plans").select("start_date, num_days").eq("id", id).eq("user_id", userId).single());
    return { start: plan.start_date, end: addDays(plan.start_date, plan.num_days - 1) };
  });
}
