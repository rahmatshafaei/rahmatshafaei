"use server";
import { z } from "zod";
import { authedAction, unwrap } from "@/lib/actions";
import { todayIso } from "@/lib/dates";
import { saveCalculatedTargets } from "@/lib/services/targets";
import { onboardingSchema } from "@/lib/validation";

const overrideSchema = z
  .object({
    calories: z.number().int().min(800).max(10000),
    protein_g: z.number().min(0).max(600),
    carbs_g: z.number().min(0).max(1500),
    fat_g: z.number().min(0).max(600),
  })
  .nullable();

export async function completeOnboarding(raw: unknown, rawOverride: unknown) {
  return authedAction(async (auth) => {
    const input = onboardingSchema.parse(raw);
    const override = overrideSchema.parse(rawOverride);

    unwrap(
      await auth.supabase
        .from("profiles")
        .update({
          display_name: input.displayName,
          age: input.age,
          sex: input.sex,
          height_cm: input.heightCm,
          start_weight_kg: input.weightKg,
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
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", auth.userId),
    );

    unwrap(
      await auth.supabase
        .from("measurements")
        .upsert({ user_id: auth.userId, measured_on: todayIso(), weight_kg: input.weightKg }, { onConflict: "user_id,measured_on" }),
    );

    await saveCalculatedTargets(
      auth,
      {
        sex: input.sex,
        age: input.age,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        activityLevel: input.activityLevel,
        goal: input.goal,
      },
      override ?? undefined,
    );
    return null;
  });
}
