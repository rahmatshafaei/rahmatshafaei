import { describe, expect, it } from "vitest";
import {
  assertValidQuantity,
  compareToTargets,
  dailyTotals,
  formatNutrient,
  matchReplacementQuantity,
  mealTotals,
  NutritionInputError,
  recipeNutrition,
  scaleNutrients,
  scalePortionsToCalories,
  substituteIngredient,
  sumNutrients,
  toPer100g,
  type NutrientsPer100g,
} from "./engine";

const chicken: NutrientsPer100g = { kcal: 106, protein: 23, carbs: 0, fat: 1.5, fiber: 0 };
const rice: NutrientsPer100g = { kcal: 128, protein: 2.6, carbs: 28.5, fat: 0.3, fiber: 0.4 };
const oil: NutrientsPer100g = { kcal: 900, protein: 0, carbs: 0, fat: 100, fiber: 0 };
const tofu: NutrientsPer100g = { kcal: 121.5, protein: 13, carbs: 1.5, fat: 7.5, fiber: 1 };
const unknownFat: NutrientsPer100g = { kcal: 50, protein: 2, carbs: 8, fat: null, fiber: null };

describe("portion scaling", () => {
  it("applies nutrient_per_100g × q / 100 to every nutrient", () => {
    const r = scaleNutrients(chicken, 150);
    expect(r.kcal).toBeCloseTo(159, 10);
    expect(r.protein).toBeCloseTo(34.5, 10);
    expect(r.carbs).toBe(0);
    expect(r.fat).toBeCloseTo(2.25, 10);
    expect(r.missing).toEqual([]);
  });

  it("keeps full precision for fractional quantities", () => {
    const r = scaleNutrients(rice, 33.3);
    expect(r.kcal).toBeCloseTo((128 * 33.3) / 100, 12);
    expect(r.carbs).toBeCloseTo((28.5 * 33.3) / 100, 12);
  });

  it("parses numeric strings from the database", () => {
    const per100 = toPer100g({ kcal_per_100g: "106.00", protein_per_100g: "23.00", carbs_per_100g: "0", fat_per_100g: "1.50", fiber_per_100g: null });
    expect(per100).toEqual({ kcal: 106, protein: 23, carbs: 0, fat: 1.5, fiber: null });
  });
});

describe("invalid quantities", () => {
  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY, 5001])("rejects %s", (q) => {
    expect(() => assertValidQuantity(q)).toThrow(NutritionInputError);
    expect(() => scaleNutrients(chicken, q)).toThrow(NutritionInputError);
  });

  it("rejects non-numbers", () => {
    expect(() => assertValidQuantity("100")).toThrow(NutritionInputError);
    expect(() => assertValidQuantity(undefined)).toThrow(NutritionInputError);
  });
});

describe("missing nutrition data", () => {
  it("never guesses unknown nutrients and reports them", () => {
    const r = scaleNutrients(unknownFat, 200);
    expect(r.fat).toBe(0);
    expect(r.kcal).toBe(100);
    expect(r.missing).toEqual(["fat"]);
  });

  it("propagates missing flags into meal totals", () => {
    const totals = mealTotals([
      { per100: chicken, quantityG: 100 },
      { per100: unknownFat, quantityG: 100 },
    ]);
    expect(totals.missing).toEqual(["fat"]);
    expect(totals.kcal).toBeCloseTo(156, 10);
  });
});

describe("macro totals", () => {
  it("sums meal portions", () => {
    const totals = mealTotals([
      { per100: chicken, quantityG: 125 },
      { per100: rice, quantityG: 200 },
      { per100: oil, quantityG: 10 },
    ]);
    expect(totals.kcal).toBeCloseTo(132.5 + 256 + 90, 10);
    expect(totals.protein).toBeCloseTo(28.75 + 5.2, 10);
    expect(totals.carbs).toBeCloseTo(57, 10);
    expect(totals.fat).toBeCloseTo(1.875 + 0.6 + 10, 10);
  });

  it("sums an empty list to zero", () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, missing: [] });
  });

  it("does not accumulate rounding errors (0.1 + 0.2 style)", () => {
    const tiny: NutrientsPer100g = { kcal: 0.1, protein: 0.1, carbs: 0.2, fat: 0, fiber: 0 };
    const totals = mealTotals(Array.from({ length: 10 }, () => ({ per100: tiny, quantityG: 100 })));
    expect(totals.kcal).toBeCloseTo(1, 12);
    expect(formatNutrient(totals.carbs, "carbs")).toBe("2");
  });
});

describe("daily totals", () => {
  it("groups by meal slot and totals the day", () => {
    const day = dailyTotals([
      { slot: "breakfast", per100: rice, quantityG: 100 },
      { slot: "lunch", per100: chicken, quantityG: 200 },
      { slot: "lunch", per100: rice, quantityG: 150 },
      { slot: "snack", per100: tofu, quantityG: 100 },
    ]);
    expect(day.bySlot.breakfast.kcal).toBeCloseTo(128, 10);
    expect(day.bySlot.lunch.kcal).toBeCloseTo(212 + 192, 10);
    expect(day.bySlot.dinner.kcal).toBe(0);
    expect(day.total.kcal).toBeCloseTo(128 + 212 + 192 + 121.5, 10);
    expect(day.total.protein).toBeCloseTo(2.6 + 46 + 3.9 + 13, 10);
  });
});

describe("recipe calculations", () => {
  it("computes totals, per serving and per 100 g", () => {
    const r = recipeNutrition(
      [
        { per100: chicken, quantityG: 500 },
        { per100: rice, quantityG: 400 },
        { per100: oil, quantityG: 20 },
      ],
      4,
    );
    expect(r.totalWeightG).toBe(920);
    expect(r.total.kcal).toBeCloseTo(530 + 512 + 180, 10);
    expect(r.perServing.kcal).toBeCloseTo(1222 / 4, 10);
    expect(r.per100g.kcal).toBeCloseTo((1222 / 920) * 100, 10);
  });

  it("marks per-100 g values as unknown when an ingredient lacks them", () => {
    const r = recipeNutrition([{ per100: unknownFat, quantityG: 100 }], 1);
    expect(r.per100g.fat).toBeNull();
  });

  it("rejects zero servings", () => {
    expect(() => recipeNutrition([{ per100: rice, quantityG: 100 }], 0)).toThrow(NutritionInputError);
  });
});

describe("ingredient substitutions", () => {
  const meal = [
    { per100: chicken, quantityG: 150 },
    { per100: rice, quantityG: 200 },
  ];

  it("matches calories by default", () => {
    const qty = matchReplacementQuantity(meal[0], tofu, "kcal");
    expect(qty).toBe(Math.round((106 * 150) / 121.5));
  });

  it("matches protein when requested", () => {
    expect(matchReplacementQuantity(meal[0], tofu, "protein")).toBe(Math.round((23 * 150) / 13));
  });

  it("returns null when the basis is unknown for the replacement", () => {
    expect(matchReplacementQuantity(meal[0], { ...tofu, protein: null }, "protein")).toBeNull();
  });

  it("recalculates the meal and reports differences", () => {
    const result = substituteIngredient(meal, 0, tofu, { basis: "kcal" });
    expect(result.replacementQuantityG).toBe(131);
    expect(result.original.kcal).toBeCloseTo(159, 10);
    expect(result.replacement.kcal).toBeCloseTo(121.5 * 1.31, 10);
    expect(result.diff.protein).toBeCloseTo(13 * 1.31 - 34.5, 10);
    expect(result.mealAfter.kcal).toBeCloseTo(result.mealBefore.kcal + result.diff.kcal, 10);
  });

  it("accepts an explicit quantity", () => {
    const result = substituteIngredient(meal, 1, chicken, { quantityG: 100 });
    expect(result.mealAfter.protein).toBeCloseTo(34.5 + 23, 10);
  });

  it("throws for a missing ingredient index", () => {
    expect(() => substituteIngredient(meal, 5, tofu)).toThrow(NutritionInputError);
  });
});

describe("target comparison and portion adjustment", () => {
  const targets = { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 67 };

  it("flags values outside tolerance", () => {
    const cmp = compareToTargets({ kcal: 2050, protein: 120, carbs: 200, fat: 67, fiber: 0, missing: [] }, targets);
    expect(cmp.find((c) => c.key === "kcal")?.withinTolerance).toBe(true);
    expect(cmp.find((c) => c.key === "protein")?.withinTolerance).toBe(false);
    expect(cmp.find((c) => c.key === "protein")?.diff).toBe(-30);
  });

  it("scales portions to a calorie target and recalculates from rounded grams", () => {
    const portions = [
      { per100: chicken, quantityG: 150 },
      { per100: rice, quantityG: 200 },
    ];
    const { portions: scaled, totals } = scalePortionsToCalories(portions, 600);
    expect(scaled.every((p) => Number.isInteger(p.quantityG))).toBe(true);
    expect(totals.kcal).toBeCloseTo(mealTotals(scaled).kcal, 10);
    expect(Math.abs(totals.kcal - 600)).toBeLessThan(5);
  });
});

describe("display formatting", () => {
  it("rounds only for display", () => {
    expect(formatNutrient(159.6, "kcal")).toBe("160");
    expect(formatNutrient(2.25, "fat")).toBe("2,3");
    expect(formatNutrient(34.5, "protein")).toBe("35");
  });
});
