import { describe, expect, it } from "vitest";
import { chooseBasis, macroProfile, rankSubstitutes, type SubstituteFood } from "./substitutes";

const food = (id: string, p: number, c: number, f: number, extra: Partial<SubstituteFood> = {}): SubstituteFood => ({
  id,
  name: id,
  category: "meat_fish",
  kcal_per_100g: 4 * p + 4 * c + 9 * f,
  protein_per_100g: p,
  carbs_per_100g: c,
  fat_per_100g: f,
  allergens: [],
  allergens_known: true,
  diet_tags: [],
  ...extra,
});

const chicken = food("chicken", 23, 0, 1.5);
const turkey = food("turkey", 24, 0, 1);
const salmon = food("salmon", 20, 0, 13, { allergens: ["fish"] });
const tofu = food("tofu", 13, 1.5, 7.5, { category: "other", diet_tags: ["vegan", "vegetarian"], allergens: ["soy"] });
const rice = food("rice", 2.6, 28.5, 0.3, { category: "grains" });

describe("macro profile", () => {
  it("computes energy shares", () => {
    const p = macroProfile(chicken);
    expect(p.protein + p.carbs + p.fat).toBeCloseTo(1, 10);
    expect(chooseBasis(chicken)).toBe("protein");
    expect(chooseBasis(rice)).toBe("kcal");
  });
});

describe("rankSubstitutes", () => {
  it("prefers foods with a similar macro profile and matches protein", () => {
    const [best] = rankSubstitutes(chicken, 150, [rice, salmon, turkey, tofu]);
    expect(best.food.id).toBe("turkey");
    expect(best.basis).toBe("protein");
    expect(best.quantityG).toBe(Math.round((23 * 150) / 24));
    expect(best.replacement.protein).toBeCloseTo(best.original.protein, 0);
  });

  it("excludes the original and foods that conflict with allergies", () => {
    const result = rankSubstitutes(chicken, 150, [chicken, salmon, turkey], { allergies: ["fish"] });
    expect(result.map((r) => r.food.id)).toEqual(["turkey"]);
  });

  it("respects diet preferences", () => {
    const result = rankSubstitutes(chicken, 150, [turkey, tofu], { dietPreferences: ["vegan"] });
    expect(result.map((r) => r.food.id)).toEqual(["tofu"]);
  });

  it("skips candidates with missing nutrition data", () => {
    const missing = food("unknown", 20, 0, 2, { fat_per_100g: null });
    expect(rankSubstitutes(chicken, 100, [missing])).toEqual([]);
  });

  it("flags unknown allergen data instead of presenting it as safe", () => {
    const uncertain = food("sausage", 22, 1, 2, { allergens_known: false });
    const [r] = rankSubstitutes(chicken, 100, [uncertain], { allergies: ["gluten"] });
    expect(r.suitability.status).toBe("unknown");
  });
});
