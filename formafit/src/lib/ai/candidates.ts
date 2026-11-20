import "server-only";
import type { AuthContext } from "@/lib/auth";
import { FOOD_COLUMNS, summarizeFoods } from "@/lib/data/foods";
import { checkSuitability } from "@/lib/nutrition/allergens";
import type { FoodSummary } from "@/lib/types";

/**
 * Foods the AI may use: visible to the user, complete macros, and compatible with declared
 * allergies, diet and restrictions. With declared allergies, foods whose allergen data is
 * incomplete are excluded so a suggestion is never presented as safe without evidence.
 *
 * The pool is the user's own, favourite and recently logged foods plus the curated everyday
 * starter set. The full reference database (thousands of foods, many of them ingredients such
 * as suet or flour types) is left out so it cannot crowd out everyday foods.
 */
export async function getCandidateFoods(
  auth: AuthContext,
  profile: { allergies: string[]; diet_preferences: string[]; food_restrictions: string[] },
  limit = 160,
): Promise<{ foods: FoodSummary[]; excludedUnknown: number }> {
  const complete = () =>
    auth.supabase
      .from("foods")
      .select(FOOD_COLUMNS)
      .eq("is_archived", false)
      .not("kcal_per_100g", "is", null)
      .not("protein_per_100g", "is", null)
      .not("carbs_per_100g", "is", null)
      .not("fat_per_100g", "is", null);
  const [recent, favorites] = await Promise.all([
    auth.supabase.from("diary_entries").select("food_id").eq("user_id", auth.userId).not("food_id", "is", null).order("entry_date", { ascending: false }).limit(300),
    auth.supabase.from("favorite_foods").select("food_id").eq("user_id", auth.userId).limit(200),
  ]);
  const usedIds = [...new Set([...(recent.data ?? []), ...(favorites.data ?? [])].map((r) => r.food_id).filter((id): id is string => Boolean(id)))];
  const results = await Promise.all([
    complete().eq("owner_id", auth.userId).limit(300),
    complete().eq("source", "starter_reference").limit(300),
    usedIds.length ? complete().in("id", usedIds.slice(0, 300)) : Promise.resolve({ data: [], error: null }),
  ]);
  const error = results.find((r) => r.error)?.error;
  if (error) throw error;
  const data = [...new Map(results.flatMap((r) => r.data ?? []).map((f) => [f.id, f])).values()];
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
