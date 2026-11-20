import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { ALLERGEN_KEYS } from "@/lib/nutrition/allergens";

/** Shared Zod schemas for server-side validation of every mutation. */

export const uuid = z.uuid({ message: "Ogiltigt id." });
export const isoDate = z.string().refine(isIsoDate, { message: "Ogiltigt datum." });
export const mealSlot = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const goal = z.enum(["fat_loss", "muscle_gain", "maintenance"]);
export const activityLevel = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);
export const experience = z.enum(["beginner", "intermediate", "advanced"]);
export const sex = z.enum(["male", "female", "unspecified"]);
export const groceryCategory = z.enum(["meat_fish", "dairy", "grains", "produce", "pantry", "other"]);
export const preparation = z.enum(["raw", "cooked", "dried", "as_sold"]);

/** Accepts "12,5" as well as "12.5" because Swedish users type decimal commas. */
const decimal = (schema: z.ZodNumber) =>
  z.preprocess((v) => {
    if (typeof v === "string") {
      const trimmed = v.trim().replace(",", ".");
      return trimmed === "" ? undefined : Number(trimmed);
    }
    return v;
  }, schema);

const optionalDecimal = (schema: z.ZodNumber) =>
  z.preprocess((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") {
      const trimmed = v.trim().replace(",", ".");
      return trimmed === "" ? null : Number(trimmed);
    }
    return v;
  }, schema.nullable());

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());

export const grams = decimal(
  z.number({ message: "Ange mängd i gram." }).positive("Mängden måste vara större än 0 g.").max(5000, "Högst 5000 g."),
);

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1, "Ange ett namn eller smeknamn.").max(60),
  age: decimal(z.number().int("Ange ålder i hela år.").min(13, "Du måste vara minst 13 år.").max(100)),
  sex,
  heightCm: decimal(z.number().min(100, "Ange längd i cm (100–250).").max(250, "Ange längd i cm (100–250).")),
  weightKg: decimal(z.number().min(30, "Ange vikt i kg (30–350).").max(350, "Ange vikt i kg (30–350).")),
  goalWeightKg: optionalDecimal(z.number().min(30).max(350)),
  activityLevel,
  dailySteps: optionalDecimal(z.number().int().min(0).max(100000)),
  trainingDaysPerWeek: decimal(z.number().int().min(0).max(7)),
  goal,
  dietPreferences: z.array(z.enum(["vegetarian", "vegan", "pescetarian", "high_protein", "low_carb"])).max(5).default([]),
  allergies: z.array(z.enum(ALLERGEN_KEYS as [string, ...string[]])).max(12).default([]),
  foodRestrictions: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  mealsPerDay: decimal(z.number().int().min(1).max(8)),
  equipment: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  experience,
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const profileUpdateSchema = onboardingSchema.omit({ weightKg: true }).extend({
  startWeightKg: optionalDecimal(z.number().min(30).max(350)),
});

export const manualTargetsSchema = z.object({
  calories: decimal(z.number().int().min(800, "Minst 800 kcal.").max(10000)),
  protein_g: decimal(z.number().min(0).max(600)),
  carbs_g: decimal(z.number().min(0).max(1500)),
  fat_g: decimal(z.number().min(0).max(600)),
  water_ml: decimal(z.number().int().min(500).max(8000)),
});

const per100 = (label: string, max = 100) =>
  optionalDecimal(z.number({ message: `Ogiltigt värde för ${label}.` }).min(0, `${label} kan inte vara negativt.`).max(max, `${label} kan vara högst ${max} per 100 g.`));

export const foodSchema = z
  .object({
    name: z.string().trim().min(1, "Ange ett namn.").max(200),
    brand: optionalText(120),
    barcode: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().regex(/^[0-9]{6,14}$/, "Streckkoden ska vara 6–14 siffror.").nullable().optional(),
    ),
    category: groceryCategory.default("other"),
    preparation: preparation.default("as_sold"),
    kcal_per_100g: per100("Energi", 900),
    protein_per_100g: per100("Protein"),
    carbs_per_100g: per100("Kolhydrater"),
    fat_per_100g: per100("Fett"),
    fiber_per_100g: per100("Fiber"),
    allergens: z.array(z.enum(ALLERGEN_KEYS as [string, ...string[]])).default([]),
    allergens_known: z.boolean().default(false),
    diet_tags: z.array(z.enum(["vegan", "vegetarian"])).default([]),
    servings: z
      .array(z.object({ label: z.string().trim().min(1).max(60), grams: decimal(z.number().positive().max(5000)) }))
      .max(10)
      .default([]),
  })
  .refine((f) => (f.protein_per_100g ?? 0) + (f.carbs_per_100g ?? 0) + (f.fat_per_100g ?? 0) <= 100.5, {
    message: "Protein, kolhydrater och fett kan tillsammans inte överstiga 100 g per 100 g.",
    path: ["fat_per_100g"],
  });
export type FoodInput = z.infer<typeof foodSchema>;

export const diaryAddSchema = z.object({
  date: isoDate,
  slot: mealSlot,
  foodId: uuid,
  quantityG: grams,
});

export const diaryUpdateSchema = z.object({
  id: uuid,
  quantityG: grams,
  slot: mealSlot,
});

export const recipeSchema = z.object({
  name: z.string().trim().min(1, "Ange ett namn.").max(120),
  kind: z.enum(["recipe", "meal"]).default("recipe"),
  servings: decimal(z.number().positive().max(100)),
  instructions: optionalText(10000),
  prepMinutes: optionalDecimal(z.number().int().min(0).max(1440)),
  defaultSlot: mealSlot.nullable().optional(),
  notes: optionalText(2000),
  ingredients: z
    .array(z.object({ foodId: uuid, quantityG: grams }))
    .min(1, "Lägg till minst en ingrediens.")
    .max(60),
});

export const mealPlanCreateSchema = z.object({
  name: z.string().trim().min(1, "Ange ett namn.").max(120),
  startDate: isoDate,
  numDays: decimal(z.number().int().min(1).max(28)),
});

export const plannedMealUpdateSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1, "Ange ett namn.").max(120),
  mealSlot,
  mealTime: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ange tid som HH:MM.").nullable().optional(),
  ),
  instructions: optionalText(10000),
  prepMinutes: optionalDecimal(z.number().int().min(0).max(1440)),
  notes: optionalText(2000),
});

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Ange ett namn.").max(120),
  primaryMuscles: z.array(z.string().min(1).max(40)).min(1, "Välj minst en primär muskelgrupp.").max(6),
  secondaryMuscles: z.array(z.string().min(1).max(40)).max(8).default([]),
  equipment: z.string().min(1, "Välj utrustning.").max(40),
  mechanics: z.enum(["compound", "isolation"]).default("compound"),
  instructions: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
  tips: optionalText(1000),
  videoUrl: z.preprocess(
    (v) => (v === "" ? null : v),
    z.url({ protocol: /^https$/, message: "Videolänken måste börja med https://" }).nullable().optional(),
  ),
});

export const programExerciseSchema = z
  .object({
    id: uuid,
    sets: decimal(z.number().int().min(1).max(20)),
    repMin: decimal(z.number().int().min(1).max(100)),
    repMax: decimal(z.number().int().min(1).max(100)),
    suggestedWeightKg: optionalDecimal(z.number().min(0).max(1000)),
    restSeconds: decimal(z.number().int().min(0).max(900)),
    tempo: z.preprocess(
      (v) => (v === "" ? null : v),
      z.string().regex(/^[0-9xX]-?[0-9xX]-?[0-9xX]-?[0-9xX]$/, "Tempo anges t.ex. 3-1-1-0.").nullable().optional(),
    ),
    supersetGroup: optionalDecimal(z.number().int().min(1).max(20)),
    notes: optionalText(1000),
  })
  .refine((v) => v.repMax >= v.repMin, { message: "Max reps måste vara minst lika med min reps.", path: ["repMax"] });

export const setLogSchema = z.object({
  setId: uuid,
  weightKg: optionalDecimal(z.number().min(0).max(1000)),
  reps: optionalDecimal(z.number().int().min(0).max(200)),
  rir: optionalDecimal(z.number().int().min(0).max(10)),
  isCompleted: z.boolean(),
  /** Device time of completion, for sets that were queued offline. */
  completedAt: z.iso.datetime().nullable().optional(),
});

export const measurementSchema = z
  .object({
    measuredOn: isoDate,
    weightKg: optionalDecimal(z.number().min(30).max(350)),
    waistCm: optionalDecimal(z.number().min(30).max(250)),
    chestCm: optionalDecimal(z.number().min(30).max(250)),
    hipsCm: optionalDecimal(z.number().min(30).max(250)),
    armCm: optionalDecimal(z.number().min(10).max(100)),
    thighCm: optionalDecimal(z.number().min(20).max(150)),
    bodyFatPct: optionalDecimal(z.number().min(2).max(70)),
    notes: optionalText(1000),
  })
  .refine(
    (m) => [m.weightKg, m.waistCm, m.chestCm, m.hipsCm, m.armCm, m.thighCm, m.bodyFatPct].some((v) => v !== null && v !== undefined),
    { message: "Fyll i minst ett mått." },
  );

export const groceryGenerateSchema = z
  .object({
    planId: uuid,
    startDate: isoDate,
    endDate: isoDate,
    name: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "Slutdatum måste vara efter startdatum.", path: ["endDate"] });

export const groceryItemSchema = z.object({
  listId: uuid,
  name: z.string().trim().min(1, "Ange en vara.").max(200),
  category: groceryCategory.default("other"),
  quantity: optionalDecimal(z.number().positive().max(100000)),
  unit: z.enum(["g", "ml", "st", "förp"]).nullable().optional(),
});

export const groceryItemUpdateSchema = z.object({
  id: uuid,
  quantity: optionalDecimal(z.number().positive().max(100000)),
  unit: z.enum(["g", "ml", "st", "förp"]).nullable().optional(),
  priceSek: optionalDecimal(z.number().min(0).max(100000)),
  note: optionalText(300),
});

export const chatMessageSchema = z.object({
  conversationId: uuid.nullable().optional(),
  message: z.string().trim().min(1, "Skriv ett meddelande.").max(4000, "Meddelandet är för långt (max 4000 tecken)."),
});

export const mealPlanGeneratorSchema = z.object({
  calories: decimal(z.number().int().min(1000).max(6000)),
  protein_g: decimal(z.number().min(0).max(500)),
  carbs_g: decimal(z.number().min(0).max(1000)),
  fat_g: decimal(z.number().min(0).max(400)),
  mealsPerDay: decimal(z.number().int().min(1).max(6)),
  days: decimal(z.number().int().min(1).max(7)),
  preferences: optionalText(500),
  budget: z.enum(["low", "medium", "high"]).nullable().optional(),
  maxCookingMinutes: optionalDecimal(z.number().int().min(5).max(240)),
  availableIngredients: optionalText(500),
  startDate: isoDate,
});
export type MealPlanGeneratorInput = z.infer<typeof mealPlanGeneratorSchema>;

export const workoutGeneratorSchema = z.object({
  experience,
  goal,
  daysPerWeek: decimal(z.number().int().min(1).max(6)),
  sessionMinutes: decimal(z.number().int().min(20).max(150)),
  equipment: z.array(z.string().min(1).max(40)).min(1, "Välj minst en typ av utrustning.").max(12),
  preferredExercises: optionalText(400),
  avoidExercises: optionalText(400),
  priorityMuscles: z.array(z.string().min(1).max(40)).max(6).default([]),
});
export type WorkoutGeneratorInput = z.infer<typeof workoutGeneratorSchema>;
