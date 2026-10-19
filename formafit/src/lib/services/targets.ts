import "server-only";
import type { AuthContext } from "@/lib/auth";
import { unwrap } from "@/lib/actions";
import { calculateTargets, type TargetInput } from "@/lib/nutrition/targets";
import type { Json } from "@/lib/supabase/database.types";

/** Persists calculated targets. Only ever called from an explicit user action. */
export async function saveCalculatedTargets(auth: AuthContext, input: TargetInput, override?: { calories: number; protein_g: number; carbs_g: number; fat_g: number }) {
  const result = calculateTargets(input);
  const manual = Boolean(
    override &&
      (override.calories !== result.calories ||
        override.protein_g !== result.protein_g ||
        override.carbs_g !== result.carbs_g ||
        override.fat_g !== result.fat_g),
  );
  const values = manual && override ? override : result;
  unwrap(
    await auth.supabase.from("nutrition_targets").upsert({
      user_id: auth.userId,
      calories: Math.round(values.calories),
      protein_g: values.protein_g,
      carbs_g: values.carbs_g,
      fat_g: values.fat_g,
      method: "mifflin_st_jeor",
      bmr_kcal: Math.round(result.bmr * 10) / 10,
      activity_multiplier: result.activityMultiplier,
      tdee_kcal: Math.round(result.tdee * 10) / 10,
      goal_adjustment_pct: result.goalAdjustmentPct,
      calculation_inputs: { ...input, calculated: { calories: result.calories, protein_g: result.protein_g, carbs_g: result.carbs_g, fat_g: result.fat_g } } as unknown as Json,
      is_manually_adjusted: manual,
    }),
  );
  return { result, manual };
}
