/**
 * Deterministic substitute ranking. Candidates are scored on how closely their macro
 * energy profile matches the original food; the replacement quantity is then derived
 * from the database values so the meal stays as close as practical to its macros.
 * AI suggestions (when configured) can only re-rank these candidates – every number
 * shown to the user still comes from this module.
 */
import { checkSuitability, type FoodSafetyInfo, type Suitability } from "./allergens";
import {
  diffNutrients,
  matchReplacementQuantity,
  scaleNutrients,
  toPer100g,
  type NutrientDiff,
  type NutrientTotals,
  type SubstitutionBasis,
} from "./engine";

export interface SubstituteFood extends FoodSafetyInfo {
  id: string;
  name: string;
  category: string;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  fiber_per_100g?: number | null;
}

export interface SubstituteOption<F extends SubstituteFood = SubstituteFood> {
  food: F;
  quantityG: number;
  basis: SubstitutionBasis;
  original: NutrientTotals;
  replacement: NutrientTotals;
  diff: NutrientDiff;
  suitability: Suitability;
  score: number;
}

/** Share of energy from protein, carbs and fat (sums to 1 when energy > 0). */
export function macroProfile(f: Pick<SubstituteFood, "protein_per_100g" | "carbs_per_100g" | "fat_per_100g">) {
  const p = (f.protein_per_100g ?? 0) * 4;
  const c = (f.carbs_per_100g ?? 0) * 4;
  const fat = (f.fat_per_100g ?? 0) * 9;
  const total = p + c + fat;
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: p / total, carbs: c / total, fat: fat / total };
}

/** Protein-dominant foods are matched on protein, everything else on energy. */
export function chooseBasis(f: SubstituteFood): SubstitutionBasis {
  return macroProfile(f).protein >= 0.4 ? "protein" : "kcal";
}

export function rankSubstitutes<F extends SubstituteFood>(
  original: SubstituteFood,
  quantityG: number,
  candidates: readonly F[],
  options: { allergies?: readonly string[]; dietPreferences?: readonly string[]; limit?: number; basis?: SubstitutionBasis } = {},
): SubstituteOption<F>[] {
  const basis = options.basis ?? chooseBasis(original);
  const originalPer100 = toPer100g(original);
  const originalTotals = scaleNutrients(originalPer100, quantityG);
  const target = macroProfile(original);
  const results: SubstituteOption<F>[] = [];
  for (const food of candidates) {
    if (food.id === original.id) continue;
    if (food.kcal_per_100g === null || food.protein_per_100g === null || food.carbs_per_100g === null || food.fat_per_100g === null) continue;
    const suitability = checkSuitability(food, options.allergies ?? [], options.dietPreferences ?? []);
    if (suitability.status === "conflict") continue;
    const per100 = toPer100g(food);
    const qty = matchReplacementQuantity({ per100: originalPer100, quantityG }, per100, basis);
    if (qty === null || qty > Math.max(quantityG * 4, 50)) continue;
    const replacementTotals = scaleNutrients(per100, qty);
    const profile = macroProfile(food);
    const distance =
      Math.abs(profile.protein - target.protein) + Math.abs(profile.carbs - target.carbs) + Math.abs(profile.fat - target.fat);
    const sameCategory = food.category === original.category ? 0 : 0.25;
    const unknownPenalty = suitability.status === "unknown" ? 0.1 : 0;
    results.push({
      food,
      quantityG: qty,
      basis,
      original: originalTotals,
      replacement: replacementTotals,
      diff: diffNutrients(originalTotals, replacementTotals),
      suitability,
      score: distance + sameCategory + unknownPenalty,
    });
  }
  return results.sort((a, b) => a.score - b.score).slice(0, options.limit ?? 6);
}
