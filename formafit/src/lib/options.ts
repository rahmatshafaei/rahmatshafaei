import { ALLERGENS, DIET_PREFERENCES } from "@/lib/nutrition/allergens";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/labels";

export const ALLERGY_OPTIONS = Object.entries(ALLERGENS).map(([value, label]) => ({ value, label }));
export const DIET_OPTIONS = Object.entries(DIET_PREFERENCES).map(([value, label]) => ({ value, label }));
export const EQUIPMENT_OPTIONS = Object.entries(EQUIPMENT_LABELS)
  .filter(([value]) => value !== "smith_machine")
  .map(([value, label]) => ({ value, label }));
export const MUSCLE_OPTIONS = Object.entries(MUSCLE_LABELS).map(([value, label]) => ({ value, label }));

/** Equipment typically available in a commercial gym. */
export const FULL_GYM = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "bands", "ez_bar", "pullup_bar"];
