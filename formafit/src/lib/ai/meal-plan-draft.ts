/**
 * Pure helpers for AI meal plans. The model only ever sees short candidate references
 * (F1, F2 …) mapped server-side to real food records; it never sees or produces database
 * IDs or nutrition values. Every returned number is recalculated by the nutrition engine.
 */
import { z } from "zod";
import { compareToTargets, mealTotals, sumNutrients, toPer100g, type MacroTargets, type NutrientTotals, type TargetComparison } from "@/lib/nutrition/engine";
import type { FoodSummary, MealSlot } from "@/lib/types";

/** Shape requested from the model (kept free of numeric constraints; validated below). */
export const aiMealSchema = z.object({
  name: z.string(),
  meal_slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  meal_time: z.string(),
  prep_minutes: z.number(),
  instructions: z.string(),
  ingredients: z.array(z.object({ ref: z.string(), grams: z.number() })),
});

export const aiMealPlanSchema = z.object({
  days: z.array(z.object({ day_index: z.number(), meals: z.array(aiMealSchema) })),
  notes: z.string(),
});

export type AiMealPlan = z.infer<typeof aiMealPlanSchema>;
export type AiMeal = z.infer<typeof aiMealSchema>;

export interface DraftIngredient {
  food: FoodSummary;
  quantityG: number;
}

export interface DraftMeal {
  name: string;
  slot: MealSlot;
  time: string | null;
  prepMinutes: number | null;
  instructions: string;
  ingredients: DraftIngredient[];
  totals: NutrientTotals;
}

export interface DraftDay {
  dayIndex: number;
  meals: DraftMeal[];
  totals: NutrientTotals;
  comparison: TargetComparison[];
}

export interface MealPlanDraft {
  days: DraftDay[];
  notes: string;
  /** Problems found while validating the AI output (shown to the user). */
  discrepancies: string[];
}

export function buildCandidateRefs(foods: readonly FoodSummary[]) {
  const map = new Map<string, FoodSummary>();
  foods.forEach((f, i) => map.set(`F${i + 1}`, f));
  return map;
}

/** Compact candidate list for the prompt: values per 100 g from the database. */
export function candidatesForPrompt(refs: Map<string, FoodSummary>): string {
  const lines: string[] = [];
  for (const [ref, f] of refs) {
    lines.push(
      `${ref} | ${f.name}${f.brand ? ` (${f.brand})` : ""} | ${Math.round(f.kcal_per_100g ?? 0)} kcal, P ${f.protein_per_100g} g, K ${f.carbs_per_100g} g, F ${f.fat_per_100g} g per 100 g | ${f.category}`,
    );
  }
  return lines.join("\n");
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function resolveMeal(meal: AiMeal, refs: Map<string, FoodSummary>, label: string, discrepancies: string[]): DraftMeal | null {
  const ingredients: DraftIngredient[] = [];
  for (const ing of meal.ingredients) {
    const food = refs.get(ing.ref.trim().toUpperCase());
    if (!food) {
      discrepancies.push(`${label}: en okänd ingrediens (${ing.ref}) togs bort.`);
      continue;
    }
    if (!Number.isFinite(ing.grams) || ing.grams < 1 || ing.grams > 2000) {
      discrepancies.push(`${label}: orimlig mängd för ${food.name} togs bort.`);
      continue;
    }
    const existing = ingredients.find((x) => x.food.id === food.id);
    const grams = Math.round(ing.grams);
    if (existing) existing.quantityG = Math.min(2000, existing.quantityG + grams);
    else ingredients.push({ food, quantityG: grams });
  }
  if (!ingredients.length) {
    discrepancies.push(`${label}: måltiden saknade giltiga ingredienser och togs bort.`);
    return null;
  }
  const prep = Number.isFinite(meal.prep_minutes) && meal.prep_minutes >= 0 && meal.prep_minutes <= 600 ? Math.round(meal.prep_minutes) : null;
  return {
    name: meal.name.trim().slice(0, 120) || "Måltid",
    slot: meal.meal_slot,
    time: TIME.test(meal.meal_time) ? meal.meal_time : null,
    prepMinutes: prep,
    instructions: meal.instructions.trim().slice(0, 4000),
    ingredients,
    totals: mealTotals(ingredients.map((i) => ({ per100: toPer100g(i.food), quantityG: i.quantityG }))),
  };
}

export function resolveMealPlan(output: AiMealPlan, refs: Map<string, FoodSummary>, targets: MacroTargets, numDays: number): MealPlanDraft {
  const discrepancies: string[] = [];
  const byIndex = new Map<number, DraftMeal[]>();
  output.days.forEach((day, position) => {
    const index = Number.isInteger(day.day_index) && day.day_index >= 0 && day.day_index < numDays ? day.day_index : position;
    if (index >= numDays) {
      discrepancies.push(`AI:n föreslog fler dagar än begärt – dag ${index + 1} togs bort.`);
      return;
    }
    const meals = day.meals
      .map((m, i) => resolveMeal(m, refs, `Dag ${index + 1}, måltid ${i + 1}`, discrepancies))
      .filter((m): m is DraftMeal => m !== null);
    byIndex.set(index, [...(byIndex.get(index) ?? []), ...meals]);
  });
  const days: DraftDay[] = [];
  for (let i = 0; i < numDays; i++) {
    const meals = byIndex.get(i) ?? [];
    if (!meals.length) discrepancies.push(`Dag ${i + 1} saknar måltider.`);
    const totals = sumNutrients(meals.map((m) => m.totals));
    const comparison = compareToTargets(totals, targets);
    for (const c of comparison) {
      if (meals.length && !c.withinTolerance) {
        const label = { kcal: "Energi", protein: "Protein", carbs: "Kolhydrater", fat: "Fett" }[c.key];
        const unit = c.key === "kcal" ? "kcal" : "g";
        discrepancies.push(
          `Dag ${i + 1}: ${label} ${Math.round(c.actual)} ${unit} jämfört med målet ${Math.round(c.target)} ${unit} (${c.diff > 0 ? "+" : ""}${Math.round(c.diff)} ${unit}).`,
        );
      }
    }
    days.push({ dayIndex: i, meals, totals, comparison });
  }
  return { days, notes: output.notes.trim().slice(0, 2000), discrepancies };
}

/** Converts an (edited) draft into the payload accepted by create_meal_plan(). */
export const savePlanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startDate: z.string(),
  numDays: z.number().int().min(1).max(28),
  notes: z.string().max(4000).optional(),
  meals: z
    .array(
      z.object({
        dayIndex: z.number().int().min(0).max(27),
        name: z.string().trim().min(1).max(120),
        slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        time: z.string().regex(TIME).nullable(),
        prepMinutes: z.number().int().min(0).max(1440).nullable(),
        instructions: z.string().max(10000),
        ingredients: z.array(z.object({ foodId: z.uuid(), quantityG: z.number().positive().max(5000) })).min(1).max(40),
      }),
    )
    .min(1)
    .max(200),
});
export type SavePlanInput = z.infer<typeof savePlanSchema>;

export function toCreatePlanPayload(input: SavePlanInput, generationMeta: Record<string, unknown>) {
  const positions = new Map<number, number>();
  return {
    name: input.name,
    start_date: input.startDate,
    num_days: input.numDays,
    source: "ai",
    notes: input.notes ?? null,
    generation_meta: generationMeta,
    meals: input.meals.map((m) => {
      const position = positions.get(m.dayIndex) ?? 0;
      positions.set(m.dayIndex, position + 1);
      return {
        day_index: m.dayIndex,
        position,
        name: m.name,
        meal_slot: m.slot,
        meal_time: m.time ?? "",
        instructions: m.instructions || null,
        prep_minutes: m.prepMinutes,
        ingredients: m.ingredients.map((i, idx) => ({ food_id: i.foodId, quantity_g: i.quantityG, position: idx })),
      };
    }),
  };
}
