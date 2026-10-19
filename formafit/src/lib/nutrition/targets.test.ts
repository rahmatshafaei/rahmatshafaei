import { describe, expect, it } from "vitest";
import { calculateTargets, caloriesFromMacros, mifflinStJeor, suggestActivityFromSteps } from "./targets";
import { checkSuitability } from "./allergens";

describe("Mifflin–St Jeor", () => {
  it("matches the published formula", () => {
    expect(mifflinStJeor({ sex: "male", age: 30, heightCm: 180, weightKg: 80 })).toBe(800 + 1125 - 150 + 5);
    expect(mifflinStJeor({ sex: "female", age: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(600 + 1031.25 - 150 - 161, 10);
    expect(mifflinStJeor({ sex: "unspecified", age: 30, heightCm: 170, weightKg: 70 })).toBeCloseTo(700 + 1062.5 - 150 - 78, 10);
  });
});

describe("calculateTargets", () => {
  it("applies activity multiplier and goal adjustment", () => {
    const r = calculateTargets({ sex: "male", age: 30, heightCm: 180, weightKg: 80, activityLevel: "moderate", goal: "maintenance" });
    expect(r.activityMultiplier).toBe(1.55);
    expect(r.tdee).toBeCloseTo(1780 * 1.55, 10);
    expect(r.calories).toBe(Math.round((1780 * 1.55) / 10) * 10);
    expect(r.protein_g).toBe(Math.round(1.6 * 80));
  });

  it("produces macros consistent with the calorie target", () => {
    const r = calculateTargets({ sex: "female", age: 28, heightCm: 168, weightKg: 65, activityLevel: "light", goal: "fat_loss" });
    expect(Math.abs(caloriesFromMacros(r) - r.calories)).toBeLessThan(15);
  });

  it("never goes below BMR or 1200 kcal", () => {
    const r = calculateTargets({ sex: "female", age: 60, heightCm: 150, weightKg: 45, activityLevel: "sedentary", goal: "fat_loss" });
    expect(r.calories).toBeGreaterThanOrEqual(1200);
    expect(r.calories).toBeGreaterThanOrEqual(Math.round(r.bmr / 10) * 10 - 10);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("uses a reference weight for protein when BMI is above 30", () => {
    const r = calculateTargets({ sex: "male", age: 40, heightCm: 175, weightKg: 130, activityLevel: "light", goal: "fat_loss" });
    expect(r.referenceWeightKg).toBeCloseTo(27 * 1.75 * 1.75, 10);
    expect(r.protein_g).toBe(Math.round(2 * 27 * 1.75 * 1.75));
  });

  it("rejects implausible input", () => {
    expect(() =>
      calculateTargets({ sex: "male", age: 5, heightCm: 180, weightKg: 80, activityLevel: "moderate", goal: "maintenance" }),
    ).toThrow(RangeError);
  });
});

describe("suggestActivityFromSteps", () => {
  it("is only a hint based on steps and training days", () => {
    expect(suggestActivityFromSteps(null, 0)).toBe("sedentary");
    expect(suggestActivityFromSteps(9000, 0)).toBe("moderate");
    expect(suggestActivityFromSteps(16000, 5)).toBe("very_active");
  });
});

describe("allergen suitability", () => {
  it("reports conflicts", () => {
    const r = checkSuitability({ allergens: ["milk", "lactose"], allergens_known: true, diet_tags: [] }, ["lactose"]);
    expect(r.status).toBe("conflict");
  });

  it("never reports unknown allergen data as safe", () => {
    const r = checkSuitability({ allergens: [], allergens_known: false, diet_tags: [] }, ["nuts"]);
    expect(r.status).toBe("unknown");
  });

  it("is ok when data is known and no allergens match", () => {
    expect(checkSuitability({ allergens: ["fish"], allergens_known: true, diet_tags: [] }, ["nuts"]).status).toBe("ok");
  });

  it("respects vegan preferences", () => {
    expect(checkSuitability({ allergens: [], allergens_known: true, diet_tags: ["vegetarian"] }, [], ["vegan"]).status).toBe("conflict");
  });
});
