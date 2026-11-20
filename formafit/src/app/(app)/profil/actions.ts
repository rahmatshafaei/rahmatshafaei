"use server";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction, unwrap, UserFacingError } from "@/lib/actions";
import { getLatestWeight } from "@/lib/data/profile";
import { calculateTargets } from "@/lib/nutrition/targets";
import { publicEnv } from "@/lib/env";
import { removeAllUserObjects } from "@/lib/services/storage";
import { saveCalculatedTargets } from "@/lib/services/targets";
import { manualTargetsSchema, profileUpdateSchema } from "@/lib/validation";
import type { AuthContext } from "@/lib/auth";

export async function updateProfile(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = profileUpdateSchema.parse(raw);
    unwrap(
      await supabase
        .from("profiles")
        .update({
          display_name: input.displayName,
          age: input.age,
          sex: input.sex,
          height_cm: input.heightCm,
          goal_weight_kg: input.goalWeightKg ?? null,
          activity_level: input.activityLevel,
          daily_steps: input.dailySteps ?? null,
          training_days_per_week: input.trainingDaysPerWeek,
          goal: input.goal,
          diet_preferences: input.dietPreferences,
          allergies: input.allergies,
          food_restrictions: input.foodRestrictions,
          meals_per_day: input.mealsPerDay,
          equipment: input.equipment,
          experience: input.experience,
        })
        .eq("id", userId),
    );
    revalidatePath("/", "layout");
    return null;
  });
}

async function recalcInput(auth: AuthContext) {
  const { data: profile } = await auth.supabase.from("profiles").select("*").eq("id", auth.userId).single();
  if (!profile?.age || !profile.height_cm || !profile.activity_level || !profile.goal) {
    throw new UserFacingError("Fyll i ålder, längd, aktivitetsnivå och mål i profilen först.");
  }
  const weight = (await getLatestWeight(auth)) ?? profile.start_weight_kg;
  if (!weight) throw new UserFacingError("Logga din vikt under Framsteg först.");
  return {
    sex: profile.sex,
    age: profile.age,
    heightCm: Number(profile.height_cm),
    weightKg: Number(weight),
    activityLevel: profile.activity_level,
    goal: profile.goal,
  };
}

/** Calculates new targets from the latest profile and weight without saving them. */
export async function previewRecalculation() {
  return authedAction(async (auth) => {
    const input = await recalcInput(auth);
    return { input, result: calculateTargets(input) };
  });
}

/** Applies a recalculation after the user reviewed the preview. */
export async function applyRecalculation() {
  return authedAction(async (auth) => {
    const input = await recalcInput(auth);
    await saveCalculatedTargets(auth, input);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function saveManualTargets(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = manualTargetsSchema.parse(raw);
    const { data: existing } = await supabase.from("nutrition_targets").select("method").eq("user_id", userId).maybeSingle();
    unwrap(
      await supabase.from("nutrition_targets").upsert({
        user_id: userId,
        calories: input.calories,
        protein_g: input.protein_g,
        carbs_g: input.carbs_g,
        fat_g: input.fat_g,
        method: existing?.method ?? "manual",
        is_manually_adjusted: true,
      }),
    );
    unwrap(await supabase.from("user_preferences").update({ water_goal_ml: input.water_ml }).eq("user_id", userId));
    revalidatePath("/", "layout");
    return null;
  });
}

const preferencesSchema = z.object({
  defaultRestSeconds: z.coerce.number().int().min(0).max(900),
  weightIncrementKg: z.coerce.number().min(0.25).max(10),
  aiShareLogs: z.boolean(),
});

export async function updatePreferences(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = preferencesSchema.parse(raw);
    unwrap(
      await supabase
        .from("user_preferences")
        .update({
          default_rest_seconds: input.defaultRestSeconds,
          weight_increment_kg: input.weightIncrementKg,
          ai_share_logs: input.aiShareLogs,
        })
        .eq("user_id", userId),
    );
    revalidatePath("/profil");
    return null;
  });
}

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Ange ditt lösenord."),
  confirm: z.literal("RADERA", { message: "Skriv RADERA för att bekräfta." }),
});

/**
 * Permanently deletes the account: re-checks the password, removes uploaded files and then
 * deletes the auth user, which cascades to all private data.
 */
export async function deleteAccount(raw: unknown) {
  return authedAction(async (auth) => {
    const input = deleteAccountSchema.parse(raw);
    if (!auth.email) throw new UserFacingError("Kontot saknar e-postadress.");
    // A stateless client verifies the password without touching the session cookies.
    const env = publicEnv();
    const verifier = createStatelessClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await verifier.auth.signInWithPassword({ email: auth.email, password: input.password });
    if (error) throw new UserFacingError("Fel lösenord.");
    await removeAllUserObjects(auth);
    unwrap(await auth.supabase.rpc("delete_my_account"));
    await auth.supabase.auth.signOut({ scope: "local" });
    return null;
  });
}
