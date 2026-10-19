/**
 * Energy and macro target estimation.
 *
 * Formula: Mifflin–St Jeor (1990) resting energy expenditure
 *   BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age(years) + s
 *   s = +5 (male), −161 (female). When sex is not specified we use the midpoint −78
 *   and tell the user that the estimate is less precise.
 *
 * Total daily energy expenditure (TDEE) = BMR × activity multiplier (see ACTIVITY_LEVELS).
 *
 * Goal adjustment: fat loss −20 %, muscle gain +10 %, maintenance ±0.
 * Safety floor: calories are never set below max(BMR, 1200 kcal).
 *
 * Macros:
 *   protein = g/kg × reference weight (fat loss 2.0, muscle gain 1.8, maintenance 1.6)
 *             reference weight = current weight, or the weight at BMI 27 when BMI > 30
 *   fat     = 25 % of energy, at least 0.6 g/kg reference weight
 *   carbs   = remaining energy / 4
 *
 * These are starting points, not measurements. Users can adjust every value manually.
 */

export type Sex = "male" | "female" | "unspecified";
export type Goal = "fat_loss" | "muscle_gain" | "maintenance";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export const ACTIVITY_LEVELS: Record<ActivityLevel, { multiplier: number; label: string; description: string }> = {
  sedentary: { multiplier: 1.2, label: "Stillasittande", description: "Kontorsarbete och lite vardagsrörelse" },
  light: { multiplier: 1.375, label: "Lätt aktiv", description: "Träning 1–3 dagar/vecka eller mycket promenader" },
  moderate: { multiplier: 1.55, label: "Måttligt aktiv", description: "Träning 3–5 dagar/vecka" },
  active: { multiplier: 1.725, label: "Mycket aktiv", description: "Hård träning 6–7 dagar/vecka" },
  very_active: { multiplier: 1.9, label: "Extremt aktiv", description: "Fysiskt arbete plus daglig träning" },
};

export const GOAL_ADJUSTMENT: Record<Goal, number> = {
  fat_loss: -0.2,
  muscle_gain: 0.1,
  maintenance: 0,
};

export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  fat_loss: 2.0,
  muscle_gain: 1.8,
  maintenance: 1.6,
};

export const SEX_CONSTANT: Record<Sex, number> = { male: 5, female: -161, unspecified: -78 };
export const MIN_CALORIES = 1200;

export interface TargetInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface TargetResult {
  bmr: number;
  activityMultiplier: number;
  tdee: number;
  goalAdjustmentPct: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  referenceWeightKg: number;
  warnings: string[];
}

export function mifflinStJeor(input: Pick<TargetInput, "sex" | "age" | "heightCm" | "weightKg">): number {
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + SEX_CONSTANT[input.sex];
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/**
 * Suggests an activity level from an optional daily step count. Only used as a hint in
 * onboarding; the user always chooses the level explicitly.
 */
export function suggestActivityFromSteps(steps: number | null | undefined, trainingDays: number): ActivityLevel {
  const s = steps ?? 0;
  if (s >= 15000 && trainingDays >= 5) return "very_active";
  if (s >= 12000 || trainingDays >= 6) return "active";
  if (s >= 8000 || trainingDays >= 3) return "moderate";
  if (s >= 5000 || trainingDays >= 1) return "light";
  return "sedentary";
}

function validate(input: TargetInput) {
  const errors: string[] = [];
  if (!(input.age >= 13 && input.age <= 100)) errors.push("Ålder måste vara 13–100 år.");
  if (!(input.heightCm >= 100 && input.heightCm <= 250)) errors.push("Längd måste vara 100–250 cm.");
  if (!(input.weightKg >= 30 && input.weightKg <= 350)) errors.push("Vikt måste vara 30–350 kg.");
  if (!(input.activityLevel in ACTIVITY_LEVELS)) errors.push("Ogiltig aktivitetsnivå.");
  if (!(input.goal in GOAL_ADJUSTMENT)) errors.push("Ogiltigt mål.");
  if (errors.length) throw new RangeError(errors.join(" "));
}

export function calculateTargets(input: TargetInput): TargetResult {
  validate(input);
  const warnings: string[] = [];
  const bmr = mifflinStJeor(input);
  const activityMultiplier = ACTIVITY_LEVELS[input.activityLevel].multiplier;
  const tdee = bmr * activityMultiplier;
  const goalAdjustmentPct = GOAL_ADJUSTMENT[input.goal];

  let calories = tdee * (1 + goalAdjustmentPct);
  const floor = Math.max(bmr, MIN_CALORIES);
  if (calories < floor) {
    calories = floor;
    warnings.push(
      "Kaloriunderskottet begränsades så att målet inte hamnar under din beräknade vilometabolism eller 1 200 kcal.",
    );
  }
  calories = Math.round(calories / 10) * 10;

  if (input.sex === "unspecified") {
    warnings.push("Utan angivet kön används ett medelvärde i formeln, vilket gör uppskattningen något mindre exakt.");
  }

  const currentBmi = bmi(input.weightKg, input.heightCm);
  const referenceWeightKg =
    currentBmi > 30 ? 27 * Math.pow(input.heightCm / 100, 2) : input.weightKg;

  let protein = PROTEIN_G_PER_KG[input.goal] * referenceWeightKg;
  let fat = Math.max((calories * 0.25) / 9, 0.6 * referenceWeightKg);
  let carbs = (calories - protein * 4 - fat * 9) / 4;

  if (carbs < 0) {
    // Very low energy targets: keep protein, reduce fat to its minimum, then carbs to 0.
    fat = Math.max(0.6 * referenceWeightKg, 0);
    carbs = Math.max((calories - protein * 4 - fat * 9) / 4, 0);
    if (protein * 4 + fat * 9 > calories) {
      protein = Math.max((calories - fat * 9) / 4, 0);
    }
    warnings.push("Målet är lågt i energi. Överväg att höja kalorierna eller rådgör med en dietist.");
  }

  return {
    bmr,
    activityMultiplier,
    tdee,
    goalAdjustmentPct: goalAdjustmentPct * 100,
    calories,
    protein_g: Math.round(protein),
    carbs_g: Math.round(carbs),
    fat_g: Math.round(fat),
    referenceWeightKg,
    warnings,
  };
}

/** Energy implied by macro grams (4/4/9 kcal per gram). */
export function caloriesFromMacros(m: { protein_g: number; carbs_g: number; fat_g: number }): number {
  return m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9;
}
