/**
 * Allergen and diet suitability checks.
 *
 * Suitability is only reported as "ok" when the food's allergen information is known
 * and contains none of the user's allergies. When allergen data is incomplete the result
 * is "unknown" and the UI must not present the food as safe.
 */

export const ALLERGENS = {
  gluten: "Gluten",
  milk: "Mjölkprotein",
  lactose: "Laktos",
  egg: "Ägg",
  fish: "Fisk",
  shellfish: "Skaldjur",
  nuts: "Nötter",
  peanuts: "Jordnötter",
  soy: "Soja",
  sesame: "Sesam",
  celery: "Selleri",
  mustard: "Senap",
} as const;
export type Allergen = keyof typeof ALLERGENS;
export const ALLERGEN_KEYS = Object.keys(ALLERGENS) as Allergen[];

export const DIET_PREFERENCES = {
  vegetarian: "Vegetarisk",
  vegan: "Vegansk",
  pescetarian: "Pescetarian",
  high_protein: "Proteinrik",
  low_carb: "Lågkolhydrat",
} as const;
export type DietPreference = keyof typeof DIET_PREFERENCES;

export interface FoodSafetyInfo {
  allergens: readonly string[];
  allergens_known: boolean;
  diet_tags: readonly string[];
  category?: string;
}

export type Suitability =
  | { status: "ok"; reasons: [] }
  | { status: "conflict"; reasons: string[] }
  | { status: "unknown"; reasons: string[] };

export function checkSuitability(
  food: FoodSafetyInfo,
  allergies: readonly string[],
  dietPreferences: readonly string[] = [],
): Suitability {
  const conflicts: string[] = [];
  for (const a of allergies) {
    if (food.allergens.includes(a)) {
      conflicts.push(`Innehåller ${ALLERGENS[a as Allergen]?.toLowerCase() ?? a}`);
    }
  }
  // Lactose intolerance also excludes foods tagged with milk where lactose status is unknown.
  if (allergies.includes("lactose") && food.allergens.includes("milk") && !food.allergens_known) {
    conflicts.push("Kan innehålla laktos");
  }

  const isVegan = food.diet_tags.includes("vegan");
  const isVegetarian = isVegan || food.diet_tags.includes("vegetarian");
  if (dietPreferences.includes("vegan") && !isVegan) conflicts.push("Inte märkt som vegansk");
  if (dietPreferences.includes("vegetarian") && !isVegetarian) conflicts.push("Inte märkt som vegetarisk");
  if (
    dietPreferences.includes("pescetarian") &&
    !isVegetarian &&
    food.category === "meat_fish" &&
    !food.allergens.includes("fish") &&
    !food.allergens.includes("shellfish")
  ) {
    conflicts.push("Innehåller kött");
  }

  if (conflicts.length) return { status: "conflict", reasons: conflicts };
  if (allergies.length > 0 && !food.allergens_known) {
    return {
      status: "unknown",
      reasons: ["Allergeninformationen är ofullständig – kontrollera förpackningen."],
    };
  }
  return { status: "ok", reasons: [] };
}
