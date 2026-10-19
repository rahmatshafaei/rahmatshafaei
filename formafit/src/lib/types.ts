import type { Enums } from "@/lib/supabase/database.types";

/** Food shape passed from server to client components. */
export interface FoodSummary {
  id: string;
  name: string;
  brand: string | null;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  fiber_per_100g: number | null;
  verification: Enums<"verification_status">;
  source: Enums<"food_source">;
  category: Enums<"grocery_category">;
  preparation: Enums<"food_preparation">;
  allergens: string[];
  allergens_known: boolean;
  diet_tags: string[];
  imageUrl: string | null;
  imageCredit: string | null;
  isOwn: boolean;
  barcode: string | null;
  servings: { id: string; label: string; grams: number }[];
}

export interface ExternalFoodResult {
  barcode: string;
  name: string;
  brand: string | null;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  imageUrl: string | null;
}

export type MealSlot = Enums<"meal_slot">;
