import "server-only";
import type { AuthContext } from "@/lib/auth";
import { signedUrls } from "@/lib/services/storage";
import type { Tables } from "@/lib/supabase/database.types";
import type { FoodSummary } from "@/lib/types";

export const FOOD_COLUMNS =
  "id, owner_id, name, brand, barcode, canonical_name, category, preparation, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, allergens, allergens_known, diet_tags, source, verification, image_path, image_url, image_credit, food_servings(id, label, grams)";

type FoodRow = Pick<
  Tables<"foods">,
  | "id" | "owner_id" | "name" | "brand" | "barcode" | "canonical_name" | "category" | "preparation" | "kcal_per_100g"
  | "protein_per_100g" | "carbs_per_100g" | "fat_per_100g" | "fiber_per_100g" | "allergens" | "allergens_known"
  | "diet_tags" | "source" | "verification" | "image_path" | "image_url" | "image_credit"
> & { food_servings?: { id: string; label: string; grams: number }[] | null };

export function toFoodSummary(row: FoodRow, urls: Map<string, string>, userId: string): FoodSummary {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    kcal_per_100g: row.kcal_per_100g,
    protein_per_100g: row.protein_per_100g,
    carbs_per_100g: row.carbs_per_100g,
    fat_per_100g: row.fat_per_100g,
    fiber_per_100g: row.fiber_per_100g,
    verification: row.verification,
    source: row.source,
    category: row.category,
    preparation: row.preparation,
    allergens: row.allergens,
    allergens_known: row.allergens_known,
    diet_tags: row.diet_tags,
    imageUrl: (row.image_path ? urls.get(row.image_path) : null) ?? row.image_url ?? null,
    imageCredit: row.image_path ? "Egen bild" : row.image_credit,
    isOwn: row.owner_id === userId,
    barcode: row.barcode,
    servings: (row.food_servings ?? []).map((s) => ({ id: s.id, label: s.label, grams: Number(s.grams) })).sort((a, b) => a.grams - b.grams),
  };
}

export async function summarizeFoods(auth: AuthContext, rows: FoodRow[]) {
  const urls = await signedUrls(auth, "user-media", rows.map((r) => r.image_path));
  return rows.map((r) => toFoodSummary(r, urls, auth.userId));
}

/** Escapes LIKE wildcards in user input. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function searchLocalFoods(auth: AuthContext, query: string, limit = 25): Promise<FoodSummary[]> {
  const q = query.trim();
  let builder = auth.supabase.from("foods").select(FOOD_COLUMNS).eq("is_archived", false).limit(limit);
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    builder = builder.or(`name.ilike.${JSON.stringify(pattern)},brand.ilike.${JSON.stringify(pattern)}`);
  } else {
    builder = builder.order("name");
  }
  const { data, error } = await builder;
  if (error) throw error;
  const lower = q.toLocaleLowerCase("sv-SE");
  const rank = (f: FoodRow) => {
    const name = f.name.toLocaleLowerCase("sv-SE");
    return (name.startsWith(lower) ? 0 : 2) + (f.owner_id ? 0 : 1);
  };
  const sorted = [...(data ?? [])].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "sv-SE"));
  return summarizeFoods(auth, sorted);
}

export async function getFoodsByIds(auth: AuthContext, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await auth.supabase.from("foods").select(FOOD_COLUMNS).in("id", [...new Set(ids)]);
  if (error) throw error;
  return summarizeFoods(auth, data ?? []);
}
