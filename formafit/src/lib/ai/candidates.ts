import "server-only";
import type { AuthContext } from "@/lib/auth";
import { FOOD_COLUMNS, summarizeFoods } from "@/lib/data/foods";
import { checkSuitability } from "@/lib/nutrition/allergens";
import type { FoodSummary } from "@/lib/types";

/**
 * Foods the AI may use: visible to the user, complete macros, and compatible with declared
 * allergies, diet and restrictions. With declared allergies, foods whose allergen data is
 * incomplete are excluded so a suggestion is never presented as safe without evidence.
 */
export async function getCandidateFoods(
  auth: AuthContext,
  profile: { allergies: string[]; diet_preferences: string[]; food_restrictions: string[] },
  limit = 160,
): Promise<{ foods: FoodSummary[]; excludedUnknown: number }> {
  const { data, error } = await auth.supabase
    .from("foods")
    .select(FOOD_COLUMNS)
    .eq("is_archived", false)
    .not("kcal_per_100g", "is", null)
    .not("protein_per_100g", "is", null)
    .not("carbs_per_100g", "is", null)
    .not("fat_per_100g", "is", null)
    .limit(600);
  if (error) throw error;
  const foods = await summarizeFoods(auth, data ?? []);
  const restrictions = profile.food_restrictions.map((r) => r.toLocaleLowerCase("sv-SE")).filter(Boolean);
  let excludedUnknown = 0;
  const allowed = foods.filter((f) => {
    const s = checkSuitability(f, profile.allergies, profile.diet_preferences);
    if (s.status === "conflict") return false;
    if (s.status === "unknown") {
      excludedUnknown += 1;
      return false;
    }
    const name = f.name.toLocaleLowerCase("sv-SE");
    return !restrictions.some((r) => name.includes(r));
  });
  allowed.sort((a, b) => Number(b.isOwn) - Number(a.isOwn) || a.name.localeCompare(b.name, "sv-SE"));
  return { foods: allowed.slice(0, limit), excludedUnknown };
}
