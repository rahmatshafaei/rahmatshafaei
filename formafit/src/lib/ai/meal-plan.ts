import "server-only";
import { z } from "zod";
import { UserFacingError } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth";
import { MEAL_SLOT_LABELS } from "@/lib/labels";
import { ALLERGENS, DIET_PREFERENCES } from "@/lib/nutrition/allergens";
import type { MealPlanGeneratorInput } from "@/lib/validation";
import { getCandidateFoods } from "./candidates";
import { generateStructured } from "./client";
import { aiMealPlanSchema, aiMealSchema, buildCandidateRefs, candidatesForPrompt, resolveMeal, resolveMealPlan, type DraftMeal, type MealPlanDraft } from "./meal-plan-draft";

const SYSTEM = `Du är FormaFits kostplanerare. Du skapar realistiska, svenska måltidsplaner för friska vuxna.
Regler:
- Använd ENBART livsmedel från kandidatlistan och referera till dem med deras kod (t.ex. "F12"). Hitta aldrig på livsmedel, koder eller näringsvärden.
- Ange mängder i gram (råvikt om livsmedlet är rått, tillagad vikt om det är tillagat).
- Använd värdena per 100 g i listan för att komma nära användarens mål för energi och makronutrienter. Appen räknar om allt själv.
- Respektera kostpreferenser, allergier och restriktioner. Föreslå inget som strider mot dem.
- Skriv måltidsnamn och korta tillagningsinstruktioner på svenska.
- Inga extrema dieter, inga medicinska påståenden.`;

function profileLines(profile: { allergies: string[]; diet_preferences: string[]; food_restrictions: string[] }) {
  const allergies = profile.allergies.map((a) => ALLERGENS[a as keyof typeof ALLERGENS] ?? a).join(", ") || "inga angivna";
  const diet = profile.diet_preferences.map((d) => DIET_PREFERENCES[d as keyof typeof DIET_PREFERENCES] ?? d).join(", ") || "inga";
  const restrictions = profile.food_restrictions.join(", ") || "inga";
  return `Allergier/intoleranser: ${allergies}\nKostpreferenser: ${diet}\nUndvik: ${restrictions}`;
}

async function loadProfile(auth: AuthContext) {
  const { data } = await auth.supabase.from("profiles").select("allergies, diet_preferences, food_restrictions").eq("id", auth.userId).single();
  return data ?? { allergies: [], diet_preferences: [], food_restrictions: [] };
}

export async function generateMealPlanDraft(auth: AuthContext, input: MealPlanGeneratorInput): Promise<MealPlanDraft & { excludedUnknown: number; model: string }> {
  const profile = await loadProfile(auth);
  const { foods, excludedUnknown } = await getCandidateFoods(auth, profile);
  if (foods.length < 8) throw new UserFacingError("Det finns för få lämpliga livsmedel i databasen för att skapa en plan. Lägg till fler livsmedel.");
  const refs = buildCandidateRefs(foods);
  const budget = { low: "låg (billiga basvaror)", medium: "normal", high: "ingen begränsning" }[input.budget ?? "medium"];
  const prompt = `Skapa en måltidsplan.
Antal dagar: ${input.days} (day_index 0–${input.days - 1})
Måltider per dag: ${input.mealsPerDay}
Mål per dag: ${input.calories} kcal, protein ${input.protein_g} g, kolhydrater ${input.carbs_g} g, fett ${input.fat_g} g
${profileLines(profile)}
Önskemål: ${input.preferences || "inga särskilda"}
Budget: ${budget}
Max tillagningstid per måltid: ${input.maxCookingMinutes ? `${input.maxCookingMinutes} minuter` : "valfri"}
Ingredienser som finns hemma (använd gärna): ${input.availableIngredients || "inga angivna"}
Variera måltiderna mellan dagarna. Ange meal_time som HH:MM. notes: en kort sammanfattning på svenska.

Kandidatlivsmedel (kod | namn | näring per 100 g | kategori):
${candidatesForPrompt(refs)}`;

  const output = await generateStructured({ schema: aiMealPlanSchema, system: SYSTEM, prompt, effort: "medium", maxTokens: 48000 });
  const draft = resolveMealPlan(output, refs, { calories: input.calories, protein_g: input.protein_g, carbs_g: input.carbs_g, fat_g: input.fat_g }, input.days);
  if (!draft.days.some((d) => d.meals.length)) throw new UserFacingError("AI:n gav inga användbara måltider. Försök igen.");
  return { ...draft, excludedUnknown, model: "claude" };
}

export const regenerateMealInput = z.object({
  slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  targetKcal: z.number().min(50).max(3000),
  targetProtein: z.number().min(0).max(300),
  otherMealNames: z.array(z.string().max(120)).max(10),
  currentName: z.string().max(120),
  wish: z.string().max(300).optional(),
});

/** Proposes a replacement for a single meal. Nothing is saved. */
export async function regenerateMealDraft(auth: AuthContext, input: z.infer<typeof regenerateMealInput>): Promise<{ meal: DraftMeal; discrepancies: string[] }> {
  const profile = await loadProfile(auth);
  const { foods } = await getCandidateFoods(auth, profile);
  const refs = buildCandidateRefs(foods);
  const prompt = `Föreslå EN ny måltid (${MEAL_SLOT_LABELS[input.slot].toLowerCase()}) som ersätter "${input.currentName}".
Mål för måltiden: cirka ${Math.round(input.targetKcal)} kcal och ${Math.round(input.targetProtein)} g protein.
Dagens övriga måltider: ${input.otherMealNames.join(", ") || "inga"} – undvik upprepning.
Önskemål: ${input.wish || "inga"}
${profileLines(profile)}

Kandidatlivsmedel (kod | namn | näring per 100 g | kategori):
${candidatesForPrompt(refs)}`;
  const meal = await generateStructured({ schema: aiMealSchema, system: SYSTEM, prompt, effort: "low", maxTokens: 8000 });
  const discrepancies: string[] = [];
  const resolved = resolveMeal({ ...meal, meal_slot: input.slot }, refs, "Måltiden", discrepancies);
  if (!resolved) throw new UserFacingError("AI:n gav ingen användbar måltid. Försök igen.");
  return { meal: resolved, discrepancies };
}
