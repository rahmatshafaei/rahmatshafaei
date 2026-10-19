"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction, unwrap } from "@/lib/actions";
import { generateStructured } from "@/lib/ai/client";
import { generateMealPlanDraft, regenerateMealDraft, regenerateMealInput } from "@/lib/ai/meal-plan";
import { savePlanSchema, toCreatePlanPayload } from "@/lib/ai/meal-plan-draft";
import { consumeAiQuota } from "@/lib/ai/rate-limit";
import { isIsoDate } from "@/lib/dates";
import type { Json } from "@/lib/supabase/database.types";
import { mealPlanGeneratorSchema, uuid } from "@/lib/validation";
import { getSubstitutes } from "./actions";

export async function generateMealPlan(raw: unknown) {
  return authedAction(async (auth) => {
    const input = mealPlanGeneratorSchema.parse(raw);
    await consumeAiQuota(auth, "meal_plan");
    return generateMealPlanDraft(auth, input);
  });
}

export async function regenerateMeal(raw: unknown) {
  return authedAction(async (auth) => {
    const input = regenerateMealInput.parse(raw);
    await consumeAiQuota(auth, "meal_regenerate");
    return regenerateMealDraft(auth, input);
  });
}

/** Saves a reviewed AI draft as a NEW plan. Existing plans are never overwritten. */
export async function saveGeneratedPlan(raw: unknown, rawMeta: unknown) {
  return authedAction(async ({ supabase }) => {
    const input = savePlanSchema.refine((v) => isIsoDate(v.startDate), { message: "Ogiltigt startdatum." }).parse(raw);
    const meta = z.record(z.string(), z.unknown()).parse(rawMeta ?? {});
    const id = unwrap(await supabase.rpc("create_meal_plan", { p_plan: toCreatePlanPayload(input, { ...meta, generated_at: new Date().toISOString() }) as unknown as Json }));
    revalidatePath("/mat/planer");
    return { id };
  });
}

const rankSchema = z.object({
  choices: z.array(z.object({ ref: z.string(), reason: z.string() })),
  note: z.string(),
});

/**
 * AI re-ranking of deterministic substitute candidates. The AI can only choose among the
 * candidates; quantities and macro differences still come from the nutrition engine.
 */
export async function aiRankSubstitutes(rawIngredientId: unknown) {
  return authedAction(async (auth) => {
    const ingredientId = uuid.parse(rawIngredientId);
    const base = await getSubstitutes(ingredientId);
    if (!base.ok) throw new Error(base.error);
    const { original, quantityG, options } = base.data;
    if (!options.length) return { options, note: "Inga alternativ att jämföra." };
    await consumeAiQuota(auth, "substitution");
    const refs = new Map(options.map((o, i) => [`S${i + 1}`, o]));
    const list = [...refs.entries()]
      .map(([ref, o]) => `${ref} | ${o.food.name} ${o.quantityG} g | ${Math.round(o.replacement.kcal)} kcal, P ${o.replacement.protein.toFixed(1)} g, K ${o.replacement.carbs.toFixed(1)} g, F ${o.replacement.fat.toFixed(1)} g`)
      .join("\n");
    const result = await generateStructured({
      schema: rankSchema,
      system:
        "Du hjälper användare att byta ingredienser i svenska måltider. Välj endast bland de givna alternativen (koder S1, S2 …) och motivera kort på svenska varför de passar i en måltid. Hitta aldrig på livsmedel eller näringsvärden och påstå aldrig att något är allergisäkert.",
      prompt: `Original: ${original.name} ${quantityG} g.\nAlternativ (redan beräknade mängder):\n${list}\n\nVälj upp till 4 bästa alternativen i rangordning för smak, användning i matlagning och närhet i makron. note: en mening.`,
      effort: "low",
      maxTokens: 4000,
    });
    const ranked = result.choices
      .map((c) => {
        const o = refs.get(c.ref.trim().toUpperCase());
        return o ? { ...o, reason: c.reason.slice(0, 300) } : null;
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);
    const seen = new Set(ranked.map((o) => o.food.id));
    return { options: [...ranked, ...options.filter((o) => !seen.has(o.food.id))], note: result.note.slice(0, 300) };
  });
}
