"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction, unwrap, UserFacingError } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth";
import { FOOD_COLUMNS, getFoodsByIds, searchLocalFoods, summarizeFoods } from "@/lib/data/foods";
import { serverEnv } from "@/lib/env";
import { normalizeIdentity } from "@/lib/grocery/aggregate";
import { recipeNutrition, toPer100g } from "@/lib/nutrition/engine";
import { getOffProduct, searchOffProducts, OffUnavailableError } from "@/lib/services/openfoodfacts";
import { uploadImage } from "@/lib/services/storage";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import type { ExternalFoodResult, FoodSummary } from "@/lib/types";
import { diaryAddSchema, diaryUpdateSchema, foodSchema, isoDate, mealSlot, recipeSchema, uuid } from "@/lib/validation";

function revalidateFood() {
  revalidatePath("/mat", "layout");
  revalidatePath("/hem");
}

// ---------------------------------------------------------------------------
// Food search
// ---------------------------------------------------------------------------

export async function searchFoods(rawQuery: unknown) {
  return authedAction(async (auth) => {
    const query = z.string().trim().max(100).parse(rawQuery);
    const local = await searchLocalFoods(auth, query);
    let external: ExternalFoodResult[] = [];
    let externalStatus: "ok" | "disabled" | "unavailable" | "skipped" = "skipped";
    const env = serverEnv();
    if (!env.OPENFOODFACTS_ENABLED) externalStatus = "disabled";
    else if (query.length >= 3) {
      try {
        const products = await searchOffProducts(query, env.OPENFOODFACTS_USER_AGENT);
        const known = new Set(local.map((f) => f.barcode).filter(Boolean));
        external = products
          .filter((p) => !known.has(p.barcode))
          .map((p) => ({
            barcode: p.barcode,
            name: p.name,
            brand: p.brand,
            kcal_per_100g: p.kcal_per_100g,
            protein_per_100g: p.protein_per_100g,
            carbs_per_100g: p.carbs_per_100g,
            fat_per_100g: p.fat_per_100g,
            imageUrl: p.image_url,
          }));
        externalStatus = "ok";
      } catch (e) {
        if (!(e instanceof OffUnavailableError)) throw e;
        externalStatus = "unavailable";
      }
    }
    return { local, external, externalStatus };
  });
}

export async function listQuickFoods() {
  return authedAction(async (auth) => {
    const [favorites, recent] = await Promise.all([
      auth.supabase.from("favorite_foods").select(`food_id, foods(${FOOD_COLUMNS})`).eq("user_id", auth.userId).limit(50),
      auth.supabase
        .from("diary_entries")
        .select("food_id, created_at")
        .eq("user_id", auth.userId)
        .not("food_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);
    const favRows = (favorites.data ?? []).map((f) => f.foods).filter((f): f is NonNullable<typeof f> => Boolean(f));
    const recentIds = [...new Set((recent.data ?? []).map((r) => r.food_id!))].slice(0, 15);
    const [favoriteFoods, recentFoods] = await Promise.all([summarizeFoods(auth, favRows), getFoodsByIds(auth, recentIds)]);
    const order = new Map(recentIds.map((id, i) => [id, i]));
    recentFoods.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { favorites: favoriteFoods, recent: recentFoods, favoriteIds: favoriteFoods.map((f) => f.id) };
  });
}

export async function toggleFavorite(rawFoodId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const foodId = uuid.parse(rawFoodId);
    const { data: existing } = await supabase.from("favorite_foods").select("food_id").eq("user_id", userId).eq("food_id", foodId).maybeSingle();
    if (existing) {
      unwrap(await supabase.from("favorite_foods").delete().eq("user_id", userId).eq("food_id", foodId));
      return { favorite: false };
    }
    unwrap(await supabase.from("favorite_foods").insert({ user_id: userId, food_id: foodId }));
    return { favorite: true };
  });
}

// ---------------------------------------------------------------------------
// Open Food Facts import and barcodes
// ---------------------------------------------------------------------------

async function importOff(auth: AuthContext, barcode: string): Promise<FoodSummary> {
  const existing = await auth.supabase
    .from("foods")
    .select(FOOD_COLUMNS)
    .eq("barcode", barcode)
    .or(`owner_id.is.null,owner_id.eq.${auth.userId}`)
    .limit(1)
    .maybeSingle();
  if (existing.data) return (await summarizeFoods(auth, [existing.data]))[0];

  const env = serverEnv();
  if (!env.OPENFOODFACTS_ENABLED) throw new UserFacingError("Produktsökning via Open Food Facts är avstängd.");
  let product;
  try {
    product = await getOffProduct(barcode, env.OPENFOODFACTS_USER_AGENT);
  } catch {
    throw new UserFacingError("Open Food Facts svarar inte just nu. Försök igen eller lägg till livsmedlet manuellt.");
  }
  if (!product) throw new UserFacingError("Produkten hittades inte. Du kan lägga till den manuellt.");

  const inserted = unwrap(
    await auth.supabase
      .from("foods")
      .insert({
        owner_id: auth.userId,
        name: product.name,
        brand: product.brand,
        barcode: product.barcode,
        canonical_name: normalizeIdentity(product.name),
        category: product.category,
        preparation: "as_sold",
        kcal_per_100g: product.kcal_per_100g,
        protein_per_100g: product.protein_per_100g,
        carbs_per_100g: product.carbs_per_100g,
        fat_per_100g: product.fat_per_100g,
        fiber_per_100g: product.fiber_per_100g,
        allergens: product.allergens,
        allergens_known: false,
        source: "openfoodfacts",
        source_ref: `https://world.openfoodfacts.org/product/${product.barcode}`,
        source_note: product.energyFromKj ? "Energi omräknad från kJ." : null,
        verification: "community",
        image_url: product.image_url,
        image_credit: product.image_url ? "Open Food Facts (CC BY-SA)" : null,
      })
      .select(FOOD_COLUMNS)
      .single(),
  );
  return (await summarizeFoods(auth, [inserted]))[0];
}

export async function importExternalFood(rawBarcode: unknown) {
  return authedAction(async (auth) => {
    const barcode = z.string().regex(/^[0-9]{6,14}$/, "Ogiltig streckkod.").parse(rawBarcode);
    const food = await importOff(auth, barcode);
    revalidateFood();
    return food;
  });
}

/** Barcode lookup: local database first, then Open Food Facts. */
export async function lookupBarcode(rawBarcode: unknown) {
  return authedAction(async (auth) => {
    const barcode = z.string().trim().regex(/^[0-9]{6,14}$/, "En streckkod består av 6–14 siffror.").parse(rawBarcode);
    return importOff(auth, barcode);
  });
}

// ---------------------------------------------------------------------------
// Custom foods
// ---------------------------------------------------------------------------

function parseFoodForm(formData: FormData) {
  const json = formData.get("data");
  if (typeof json !== "string") throw new UserFacingError("Ogiltigt formulär.");
  return foodSchema.parse(JSON.parse(json));
}

export async function createFood(formData: FormData) {
  return authedAction(async (auth) => {
    const input = parseFoodForm(formData);
    const image = formData.get("image");
    const imagePath = image instanceof File && image.size > 0 ? await uploadImage(auth, "user-media", "foods", image) : null;
    const food = unwrap(
      await auth.supabase
        .from("foods")
        .insert({
          owner_id: auth.userId,
          name: input.name,
          brand: input.brand ?? null,
          barcode: input.barcode ?? null,
          canonical_name: normalizeIdentity(input.name),
          category: input.category,
          preparation: input.preparation,
          kcal_per_100g: input.kcal_per_100g,
          protein_per_100g: input.protein_per_100g,
          carbs_per_100g: input.carbs_per_100g,
          fat_per_100g: input.fat_per_100g,
          fiber_per_100g: input.fiber_per_100g,
          allergens: input.allergens,
          allergens_known: input.allergens_known,
          diet_tags: input.diet_tags,
          source: "user",
          verification: "user_entered",
          image_path: imagePath,
        })
        .select("id")
        .single(),
    );
    if (input.servings.length) {
      unwrap(
        await auth.supabase
          .from("food_servings")
          .insert(input.servings.map((s) => ({ food_id: food.id, owner_id: auth.userId, label: s.label, grams: s.grams }))),
      );
    }
    revalidateFood();
    return { id: food.id };
  });
}

export async function updateFood(foodId: string, formData: FormData) {
  return authedAction(async (auth) => {
    const id = uuid.parse(foodId);
    const input = parseFoodForm(formData);
    const image = formData.get("image");
    const update: TablesUpdate<"foods"> = {
      name: input.name,
      brand: input.brand ?? null,
      barcode: input.barcode ?? null,
      canonical_name: normalizeIdentity(input.name),
      category: input.category,
      preparation: input.preparation,
      kcal_per_100g: input.kcal_per_100g,
      protein_per_100g: input.protein_per_100g,
      carbs_per_100g: input.carbs_per_100g,
      fat_per_100g: input.fat_per_100g,
      fiber_per_100g: input.fiber_per_100g,
      allergens: input.allergens,
      allergens_known: input.allergens_known,
      diet_tags: input.diet_tags,
      // Editing values of an imported product makes them the user's own data.
      verification: "user_entered",
    };
    if (image instanceof File && image.size > 0) update.image_path = await uploadImage(auth, "user-media", "foods", image);
    const updated = unwrap(
      await auth.supabase.from("foods").update(update).eq("id", id).eq("owner_id", auth.userId).select("id"),
    );
    if (!updated.length) throw new UserFacingError("Du kan bara ändra egna livsmedel.");
    unwrap(await auth.supabase.from("food_servings").delete().eq("food_id", id).eq("owner_id", auth.userId));
    if (input.servings.length) {
      unwrap(
        await auth.supabase
          .from("food_servings")
          .insert(input.servings.map((s) => ({ food_id: id, owner_id: auth.userId, label: s.label, grams: s.grams }))),
      );
    }
    revalidateFood();
    return { id };
  });
}

export async function archiveFood(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    // Archive instead of delete: plans and recipes may still reference the food,
    // and diary history keeps its own snapshot.
    const rows = unwrap(await supabase.from("foods").update({ is_archived: true }).eq("id", id).eq("owner_id", userId).select("id"));
    if (!rows.length) throw new UserFacingError("Du kan bara ta bort egna livsmedel.");
    revalidateFood();
    return null;
  });
}

// ---------------------------------------------------------------------------
// Diary entries
// ---------------------------------------------------------------------------

export async function addDiaryEntry(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = diaryAddSchema.parse(raw);
    const food = unwrap(
      await supabase
        .from("foods")
        .select("id, name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, verification")
        .eq("id", input.foodId)
        .single(),
    );
    const { count } = await supabase
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("entry_date", input.date)
      .eq("meal_slot", input.slot);
    unwrap(
      await supabase.from("diary_entries").insert({
        user_id: userId,
        entry_date: input.date,
        meal_slot: input.slot,
        position: count ?? 0,
        food_id: food.id,
        food_name: food.name,
        brand: food.brand,
        quantity_g: input.quantityG,
        kcal_per_100g: food.kcal_per_100g,
        protein_per_100g: food.protein_per_100g,
        carbs_per_100g: food.carbs_per_100g,
        fat_per_100g: food.fat_per_100g,
        fiber_per_100g: food.fiber_per_100g,
        verification: food.verification,
      }),
    );
    revalidateFood();
    return null;
  });
}

const addFoodsSchema = z.object({
  date: isoDate,
  slot: mealSlot,
  label: z.string().trim().max(120).optional(),
  items: z.array(z.object({ foodId: uuid, quantityG: z.number().positive().max(5000) })).min(1).max(40),
});

/** Logs several foods at once (e.g. a meal from an unsaved AI draft). */
export async function addFoodsToDiary(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = addFoodsSchema.parse(raw);
    const foods = unwrap(
      await supabase
        .from("foods")
        .select("id, name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, verification")
        .in("id", input.items.map((i) => i.foodId)),
    );
    const byId = new Map(foods.map((f) => [f.id, f]));
    const rows = input.items.map((item, idx) => {
      const f = byId.get(item.foodId);
      if (!f) throw new UserFacingError("Ett livsmedel hittades inte.");
      return {
        user_id: userId,
        entry_date: input.date,
        meal_slot: input.slot,
        position: 200 + idx,
        food_id: f.id,
        food_name: f.name,
        brand: f.brand,
        quantity_g: item.quantityG,
        kcal_per_100g: f.kcal_per_100g,
        protein_per_100g: f.protein_per_100g,
        carbs_per_100g: f.carbs_per_100g,
        fat_per_100g: f.fat_per_100g,
        fiber_per_100g: f.fiber_per_100g,
        verification: f.verification,
        recipe_name: input.label ?? null,
      };
    });
    unwrap(await supabase.from("diary_entries").insert(rows));
    revalidateFood();
    return { count: rows.length };
  });
}

export async function updateDiaryEntry(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = diaryUpdateSchema.parse(raw);
    const rows = unwrap(
      await supabase
        .from("diary_entries")
        .update({ quantity_g: input.quantityG, meal_slot: input.slot })
        .eq("id", input.id)
        .eq("user_id", userId)
        .select("id"),
    );
    if (!rows.length) throw new UserFacingError("Posten hittades inte.");
    revalidateFood();
    return null;
  });
}

export async function deleteDiaryEntry(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    unwrap(await supabase.from("diary_entries").delete().eq("id", id).eq("user_id", userId));
    revalidateFood();
    return null;
  });
}

export async function duplicateDiaryEntry(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    const e = unwrap(await supabase.from("diary_entries").select("*").eq("id", id).eq("user_id", userId).single());
    unwrap(
      await supabase.from("diary_entries").insert({
        user_id: userId,
        entry_date: e.entry_date,
        meal_slot: e.meal_slot,
        position: e.position + 1,
        food_id: e.food_id,
        food_name: e.food_name,
        brand: e.brand,
        quantity_g: e.quantity_g,
        kcal_per_100g: e.kcal_per_100g,
        protein_per_100g: e.protein_per_100g,
        carbs_per_100g: e.carbs_per_100g,
        fat_per_100g: e.fat_per_100g,
        fiber_per_100g: e.fiber_per_100g,
        verification: e.verification,
        recipe_id: e.recipe_id,
        recipe_name: e.recipe_name,
      }),
    );
    revalidateFood();
    return null;
  });
}

const copySchema = z
  .object({ from: isoDate, to: isoDate, slot: mealSlot.nullable().optional(), targetSlot: mealSlot.nullable().optional() })
  .refine((v) => v.from !== v.to || (v.slot && v.targetSlot && v.slot !== v.targetSlot), {
    message: "Välj ett annat datum eller en annan måltid att kopiera till.",
  });

export async function copyDiary(raw: unknown) {
  return authedAction(async ({ supabase }) => {
    const input = copySchema.parse(raw);
    const count = unwrap(
      await supabase.rpc("copy_diary_entries", {
        p_from: input.from,
        p_to: input.to,
        p_slot: input.slot ?? undefined,
        p_target_slot: input.targetSlot ?? undefined,
      }),
    );
    revalidateFood();
    return { count };
  });
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

export async function addWater(rawDate: unknown, rawMl: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const date = isoDate.parse(rawDate);
    const ml = z.number().int().min(1).max(5000).parse(rawMl);
    unwrap(await supabase.from("water_logs").insert({ user_id: userId, log_date: date, amount_ml: ml }));
    revalidateFood();
    return null;
  });
}

export async function removeWater(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    unwrap(await supabase.from("water_logs").delete().eq("id", id).eq("user_id", userId));
    revalidateFood();
    return null;
  });
}

// ---------------------------------------------------------------------------
// Recipes and saved meals
// ---------------------------------------------------------------------------

export async function saveRecipe(rawId: unknown, raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = rawId ? uuid.parse(rawId) : null;
    const input = recipeSchema.parse(raw);
    const values = {
      user_id: userId,
      name: input.name,
      kind: input.kind,
      servings: input.servings,
      instructions: input.instructions ?? null,
      prep_minutes: input.prepMinutes ?? null,
      default_slot: input.defaultSlot ?? null,
      notes: input.notes ?? null,
    };
    let recipeId = id;
    if (id) {
      const rows = unwrap(await supabase.from("recipes").update(values).eq("id", id).eq("user_id", userId).select("id"));
      if (!rows.length) throw new UserFacingError("Receptet hittades inte.");
      unwrap(await supabase.from("recipe_ingredients").delete().eq("recipe_id", id).eq("user_id", userId));
    } else {
      recipeId = unwrap(await supabase.from("recipes").insert(values).select("id").single()).id;
    }
    unwrap(
      await supabase.from("recipe_ingredients").insert(
        input.ingredients.map((ing, i) => ({
          recipe_id: recipeId!,
          user_id: userId,
          food_id: ing.foodId,
          quantity_g: ing.quantityG,
          position: i,
        })),
      ),
    );
    revalidateFood();
    return { id: recipeId! };
  });
}

export async function deleteRecipe(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    unwrap(await supabase.from("recipes").delete().eq("id", id).eq("user_id", userId));
    revalidateFood();
    return null;
  });
}

export async function listRecipes() {
  return authedAction(async ({ supabase, userId }) => {
    const rows = unwrap(
      await supabase
        .from("recipes")
        .select("id, name, kind, servings, default_slot, recipe_ingredients(quantity_g, foods(kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g))")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(100),
    );
    return rows.map((r) => {
      const n = recipeNutrition(
        r.recipe_ingredients.filter((i) => i.foods).map((i) => ({ per100: toPer100g(i.foods!), quantityG: Number(i.quantity_g) })),
        Number(r.servings),
      );
      return { id: r.id, name: r.name, kind: r.kind, servings: Number(r.servings), perServing: n.perServing };
    });
  });
}

const logRecipeSchema = z.object({
  recipeId: uuid,
  date: isoDate,
  slot: mealSlot,
  portions: z.coerce.number().positive("Ange antal portioner.").max(20),
});

/** Logs a recipe by expanding its ingredients, scaled by portions / servings. */
export async function logRecipe(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = logRecipeSchema.parse(raw);
    const recipe = unwrap(
      await supabase
        .from("recipes")
        .select("id, name, servings, recipe_ingredients(position, quantity_g, foods(id, name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, verification))")
        .eq("id", input.recipeId)
        .eq("user_id", userId)
        .single(),
    );
    const factor = input.portions / Number(recipe.servings);
    const rows = recipe.recipe_ingredients
      .filter((i) => i.foods)
      .sort((a, b) => a.position - b.position)
      .map((i, idx) => {
        const qty = Math.round(Number(i.quantity_g) * factor * 10) / 10;
        if (qty <= 0 || qty > 5000) throw new UserFacingError("Portionen ger en ogiltig mängd för en ingrediens.");
        const f = i.foods!;
        return {
          user_id: userId,
          entry_date: input.date,
          meal_slot: input.slot,
          position: 100 + idx,
          food_id: f.id,
          food_name: f.name,
          brand: f.brand,
          quantity_g: qty,
          kcal_per_100g: f.kcal_per_100g,
          protein_per_100g: f.protein_per_100g,
          carbs_per_100g: f.carbs_per_100g,
          fat_per_100g: f.fat_per_100g,
          fiber_per_100g: f.fiber_per_100g,
          verification: f.verification,
          recipe_id: recipe.id,
          recipe_name: recipe.name,
        };
      });
    if (!rows.length) throw new UserFacingError("Receptet saknar ingredienser.");
    unwrap(await supabase.from("diary_entries").insert(rows));
    revalidateFood();
    return { count: rows.length };
  });
}

const saveSlotSchema = z.object({ date: isoDate, slot: mealSlot, name: z.string().trim().min(1, "Ange ett namn.").max(120) });

/** Saves the foods of a diary meal as a reusable meal. */
export async function saveSlotAsMeal(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = saveSlotSchema.parse(raw);
    const entries = unwrap(
      await supabase
        .from("diary_entries")
        .select("food_id, quantity_g, position")
        .eq("user_id", userId)
        .eq("entry_date", input.date)
        .eq("meal_slot", input.slot)
        .not("food_id", "is", null)
        .order("position"),
    );
    if (!entries.length) throw new UserFacingError("Måltiden innehåller inga livsmedel att spara.");
    const recipe = unwrap(
      await supabase.from("recipes").insert({ user_id: userId, name: input.name, kind: "meal", servings: 1, default_slot: input.slot }).select("id").single(),
    );
    unwrap(
      await supabase.from("recipe_ingredients").insert(
        entries.map((e, i) => ({ recipe_id: recipe.id, user_id: userId, food_id: e.food_id!, quantity_g: e.quantity_g, position: i })),
      ),
    );
    revalidateFood();
    return { id: recipe.id };
  });
}

// ---------------------------------------------------------------------------
// Planned meals -> diary
// ---------------------------------------------------------------------------

export async function markPlannedMealEaten(rawMealId: unknown, rawDate: unknown) {
  return authedAction(async ({ supabase }) => {
    const mealId = uuid.parse(rawMealId);
    const date = isoDate.parse(rawDate);
    const rows = unwrap(await supabase.rpc("mark_planned_meal_eaten", { p_planned_meal_id: mealId, p_date: date }));
    revalidateFood();
    return { created: rows[0]?.created ?? false };
  });
}

export async function undoConsumption(rawId: unknown) {
  return authedAction(async ({ supabase }) => {
    const id = uuid.parse(rawId);
    unwrap(await supabase.rpc("undo_meal_consumption", { p_consumption_id: id }));
    revalidateFood();
    return null;
  });
}
