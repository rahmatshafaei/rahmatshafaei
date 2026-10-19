/**
 * Deterministic nutrition engine.
 *
 * All values are stored per 100 g. For a quantity q (grams):
 *
 *   nutrient_amount = nutrient_per_100g × q / 100
 *
 * Calculations use full floating point precision; round only when displaying
 * (see `formatNutrient`). A nutrient that is unknown (null) for a food is never
 * guessed: it contributes 0 to totals and is reported in `missing` so the UI can
 * flag the total as incomplete.
 */

export const NUTRIENT_KEYS = ["kcal", "protein", "carbs", "fat", "fiber"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** Core macros that must be known for a food to count as complete. Fibre is optional. */
export const CORE_NUTRIENTS: readonly NutrientKey[] = ["kcal", "protein", "carbs", "fat"];

export type NutrientsPer100g = Record<NutrientKey, number | null>;

export interface NutrientTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** Core nutrients that were unknown for at least one contributing item. */
  missing: NutrientKey[];
}

export const MAX_QUANTITY_G = 5000;

export class NutritionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NutritionInputError";
  }
}

/** Throws a NutritionInputError for anything that is not a usable gram quantity. */
export function assertValidQuantity(grams: unknown): asserts grams is number {
  if (typeof grams !== "number" || !Number.isFinite(grams)) {
    throw new NutritionInputError("Mängden måste vara ett tal.");
  }
  if (grams <= 0) {
    throw new NutritionInputError("Mängden måste vara större än 0 g.");
  }
  if (grams > MAX_QUANTITY_G) {
    throw new NutritionInputError(`Mängden får vara högst ${MAX_QUANTITY_G} g.`);
  }
}

export function isValidQuantity(grams: unknown): grams is number {
  try {
    assertValidQuantity(grams);
    return true;
  } catch {
    return false;
  }
}

export function emptyTotals(): NutrientTotals {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, missing: [] };
}

/** Normalises database/numeric-string values into the engine's per-100 g shape. */
export function toPer100g(row: {
  kcal_per_100g: number | string | null;
  protein_per_100g: number | string | null;
  carbs_per_100g: number | string | null;
  fat_per_100g: number | string | null;
  fiber_per_100g?: number | string | null;
}): NutrientsPer100g {
  const num = (v: number | string | null | undefined) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    kcal: num(row.kcal_per_100g),
    protein: num(row.protein_per_100g),
    carbs: num(row.carbs_per_100g),
    fat: num(row.fat_per_100g),
    fiber: num(row.fiber_per_100g),
  };
}

/** Returns the core nutrients that are unknown for a food. */
export function missingNutrients(per100: NutrientsPer100g): NutrientKey[] {
  return CORE_NUTRIENTS.filter((k) => per100[k] === null);
}

/** Scales per-100 g values to an amount in grams. */
export function scaleNutrients(per100: NutrientsPer100g, grams: number): NutrientTotals {
  assertValidQuantity(grams);
  const factor = grams / 100;
  const scale = (v: number | null) => (v === null ? 0 : v * factor);
  return {
    kcal: scale(per100.kcal),
    protein: scale(per100.protein),
    carbs: scale(per100.carbs),
    fat: scale(per100.fat),
    fiber: scale(per100.fiber),
    missing: missingNutrients(per100),
  };
}

export function sumNutrients(items: readonly NutrientTotals[]): NutrientTotals {
  const total = emptyTotals();
  const missing = new Set<NutrientKey>();
  for (const item of items) {
    total.kcal += item.kcal;
    total.protein += item.protein;
    total.carbs += item.carbs;
    total.fat += item.fat;
    total.fiber += item.fiber;
    item.missing.forEach((k) => missing.add(k));
  }
  total.missing = NUTRIENT_KEYS.filter((k) => missing.has(k));
  return total;
}

export interface Portion {
  per100: NutrientsPer100g;
  quantityG: number;
}

/** Nutrition of a meal / any list of portions. */
export function mealTotals(portions: readonly Portion[]): NutrientTotals {
  return sumNutrients(portions.map((p) => scaleNutrients(p.per100, p.quantityG)));
}

export interface RecipeNutrition {
  total: NutrientTotals;
  perServing: NutrientTotals;
  totalWeightG: number;
  /** Nutrition per 100 g of the finished recipe based on raw ingredient weight. */
  per100g: NutrientsPer100g;
}

export function recipeNutrition(portions: readonly Portion[], servings: number): RecipeNutrition {
  if (!Number.isFinite(servings) || servings <= 0) {
    throw new NutritionInputError("Antal portioner måste vara större än 0.");
  }
  const total = mealTotals(portions);
  const totalWeightG = portions.reduce((sum, p) => sum + p.quantityG, 0);
  const divide = (t: NutrientTotals, d: number): NutrientTotals => ({
    kcal: t.kcal / d,
    protein: t.protein / d,
    carbs: t.carbs / d,
    fat: t.fat / d,
    fiber: t.fiber / d,
    missing: [...t.missing],
  });
  const per100Totals = totalWeightG > 0 ? divide(total, totalWeightG / 100) : emptyTotals();
  const missing = new Set(total.missing);
  const per100g: NutrientsPer100g = {
    kcal: missing.has("kcal") ? null : per100Totals.kcal,
    protein: missing.has("protein") ? null : per100Totals.protein,
    carbs: missing.has("carbs") ? null : per100Totals.carbs,
    fat: missing.has("fat") ? null : per100Totals.fat,
    fiber: per100Totals.fiber,
  };
  return { total, perServing: divide(total, servings), totalWeightG, per100g };
}

export type NutrientDiff = Record<Exclude<NutrientKey, "fiber">, number>;

/** b − a for each core nutrient. */
export function diffNutrients(a: NutrientTotals, b: NutrientTotals): NutrientDiff {
  return {
    kcal: b.kcal - a.kcal,
    protein: b.protein - a.protein,
    carbs: b.carbs - a.carbs,
    fat: b.fat - a.fat,
  };
}

export type SubstitutionBasis = "kcal" | "protein" | "same_weight";

/**
 * Grams of the replacement food that match the original portion on the chosen basis.
 * Returns null when the basis nutrient is unknown or zero for the replacement.
 * The result is rounded to whole grams because it is a quantity the user will weigh.
 */
export function matchReplacementQuantity(
  original: Portion,
  replacement: NutrientsPer100g,
  basis: SubstitutionBasis,
): number | null {
  assertValidQuantity(original.quantityG);
  if (basis === "same_weight") return original.quantityG;
  const target = original.per100[basis];
  const replacementPer100 = replacement[basis];
  if (target === null || replacementPer100 === null || replacementPer100 <= 0) return null;
  const grams = (target * original.quantityG) / replacementPer100;
  const rounded = Math.round(grams);
  if (rounded <= 0) return null;
  return Math.min(rounded, MAX_QUANTITY_G);
}

export interface SubstitutionResult {
  replacementQuantityG: number;
  original: NutrientTotals;
  replacement: NutrientTotals;
  diff: NutrientDiff;
  mealBefore: NutrientTotals;
  mealAfter: NutrientTotals;
}

/**
 * Replaces portions[index] with a new food and recalculates the meal.
 * When quantityG is omitted it is derived from `basis`.
 */
export function substituteIngredient(
  portions: readonly Portion[],
  index: number,
  replacement: NutrientsPer100g,
  options: { basis?: SubstitutionBasis; quantityG?: number } = {},
): SubstitutionResult {
  const original = portions[index];
  if (!original) throw new NutritionInputError("Ingrediensen finns inte i måltiden.");
  const quantity =
    options.quantityG ?? matchReplacementQuantity(original, replacement, options.basis ?? "kcal");
  if (quantity === null) {
    throw new NutritionInputError("Ersättningen saknar näringsvärden för vald jämförelse.");
  }
  assertValidQuantity(quantity);
  const originalTotals = scaleNutrients(original.per100, original.quantityG);
  const replacementTotals = scaleNutrients(replacement, quantity);
  const after = portions.map((p, i) => (i === index ? { per100: replacement, quantityG: quantity } : p));
  return {
    replacementQuantityG: quantity,
    original: originalTotals,
    replacement: replacementTotals,
    diff: diffNutrients(originalTotals, replacementTotals),
    mealBefore: mealTotals(portions),
    mealAfter: mealTotals(after),
  };
}

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export interface DiaryLine extends Portion {
  slot: MealSlot;
}

export interface DailyTotals {
  bySlot: Record<MealSlot, NutrientTotals>;
  total: NutrientTotals;
}

export function dailyTotals(lines: readonly DiaryLine[]): DailyTotals {
  const bySlot = Object.fromEntries(
    MEAL_SLOTS.map((slot) => [slot, mealTotals(lines.filter((l) => l.slot === slot))]),
  ) as Record<MealSlot, NutrientTotals>;
  return { bySlot, total: sumNutrients(MEAL_SLOTS.map((s) => bySlot[s])) };
}

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface TargetComparison {
  key: "kcal" | "protein" | "carbs" | "fat";
  target: number;
  actual: number;
  diff: number;
  /** actual / target, or null when the target is 0. */
  ratio: number | null;
  withinTolerance: boolean;
}

/** Default tolerances used when judging a generated plan against targets. */
export const DEFAULT_TOLERANCE = { kcal: 0.05, protein: 0.1, carbs: 0.15, fat: 0.15 } as const;

export function compareToTargets(
  totals: NutrientTotals,
  targets: MacroTargets,
  tolerance: Record<TargetComparison["key"], number> = DEFAULT_TOLERANCE,
): TargetComparison[] {
  const pairs: [TargetComparison["key"], number, number][] = [
    ["kcal", targets.calories, totals.kcal],
    ["protein", targets.protein_g, totals.protein],
    ["carbs", targets.carbs_g, totals.carbs],
    ["fat", targets.fat_g, totals.fat],
  ];
  return pairs.map(([key, target, actual]) => {
    const ratio = target > 0 ? actual / target : null;
    return {
      key,
      target,
      actual,
      diff: actual - target,
      ratio,
      withinTolerance: ratio === null ? actual === 0 : Math.abs(ratio - 1) <= tolerance[key],
    };
  });
}

/**
 * Scales every portion by the same factor so the total matches a calorie target.
 * Quantities are rounded to whole grams; the returned totals are recalculated from the
 * rounded quantities so they reflect exactly what the user will see and weigh.
 */
export function scalePortionsToCalories(
  portions: readonly Portion[],
  targetKcal: number,
): { portions: Portion[]; factor: number; totals: NutrientTotals } {
  const current = mealTotals(portions);
  if (current.kcal <= 0 || !Number.isFinite(targetKcal) || targetKcal <= 0) {
    return { portions: [...portions], factor: 1, totals: current };
  }
  const factor = targetKcal / current.kcal;
  const scaled = portions.map((p) => ({
    per100: p.per100,
    quantityG: Math.min(MAX_QUANTITY_G, Math.max(1, Math.round(p.quantityG * factor))),
  }));
  return { portions: scaled, factor, totals: mealTotals(scaled) };
}

/** Display rounding: kcal to whole numbers, grams to one decimal below 10 g, else whole. */
export function formatNutrient(value: number, key: NutrientKey): string {
  const v = Math.abs(value) < 1e-9 ? 0 : value;
  if (key === "kcal") return Math.round(v).toLocaleString("sv-SE");
  const decimals = Math.abs(v) < 10 ? 1 : 0;
  return v.toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}
