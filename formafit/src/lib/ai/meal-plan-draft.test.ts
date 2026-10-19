import { describe, expect, it } from "vitest";
import type { FoodSummary } from "@/lib/types";
import { buildCandidateRefs, candidatesForPrompt, resolveMealPlan, toCreatePlanPayload } from "./meal-plan-draft";

const food = (id: string, name: string, kcal: number, p: number, c: number, f: number): FoodSummary => ({
  id,
  name,
  brand: null,
  kcal_per_100g: kcal,
  protein_per_100g: p,
  carbs_per_100g: c,
  fat_per_100g: f,
  fiber_per_100g: 0,
  verification: "estimated",
  source: "starter_reference",
  category: "other",
  preparation: "as_sold",
  allergens: [],
  allergens_known: true,
  diet_tags: [],
  imageUrl: null,
  imageCredit: null,
  isOwn: false,
  barcode: null,
  servings: [],
});

const oats = food("11111111-1111-4111-8111-111111111111", "Havregryn", 367, 13, 58, 7);
const milk = food("22222222-2222-4222-8222-222222222222", "Mjölk", 46, 3.5, 4.8, 1.5);
const refs = buildCandidateRefs([oats, milk]);
const targets = { calories: 500, protein_g: 20, carbs_g: 80, fat_g: 12 };

describe("candidate refs", () => {
  it("never exposes database ids to the model", () => {
    const text = candidatesForPrompt(refs);
    expect(text).toContain("F1 | Havregryn");
    expect(text).not.toContain(oats.id);
  });
});

describe("resolveMealPlan", () => {
  it("maps refs to real foods and recalculates nutrition from the database", () => {
    const draft = resolveMealPlan(
      {
        notes: "",
        days: [
          {
            day_index: 0,
            meals: [
              {
                name: "Gröt",
                meal_slot: "breakfast",
                meal_time: "07:30",
                prep_minutes: 5,
                instructions: "Koka.",
                ingredients: [
                  { ref: "F1", grams: 80 },
                  { ref: "f2", grams: 200 },
                ],
              },
            ],
          },
        ],
      },
      refs,
      targets,
      1,
    );
    const meal = draft.days[0].meals[0];
    expect(meal.ingredients.map((i) => i.food.id)).toEqual([oats.id, milk.id]);
    expect(meal.totals.kcal).toBeCloseTo(367 * 0.8 + 46 * 2, 10);
    expect(draft.days[0].totals.kcal).toBeCloseTo(meal.totals.kcal, 10);
  });

  it("drops invented foods and unreasonable quantities and reports them", () => {
    const draft = resolveMealPlan(
      {
        notes: "",
        days: [
          {
            day_index: 0,
            meals: [
              {
                name: "X",
                meal_slot: "lunch",
                meal_time: "25:99",
                prep_minutes: -4,
                instructions: "",
                ingredients: [
                  { ref: "F99", grams: 100 },
                  { ref: "F1", grams: 99999 },
                  { ref: "F2", grams: 250 },
                ],
              },
            ],
          },
        ],
      },
      refs,
      targets,
      1,
    );
    const meal = draft.days[0].meals[0];
    expect(meal.ingredients).toHaveLength(1);
    expect(meal.time).toBeNull();
    expect(meal.prepMinutes).toBeNull();
    expect(draft.discrepancies.some((d) => d.includes("okänd ingrediens"))).toBe(true);
    expect(draft.discrepancies.some((d) => d.includes("orimlig mängd"))).toBe(true);
  });

  it("reports differences from the targets and missing days", () => {
    const draft = resolveMealPlan(
      { notes: "", days: [{ day_index: 0, meals: [{ name: "Liten", meal_slot: "snack", meal_time: "", prep_minutes: 0, instructions: "", ingredients: [{ ref: "F2", grams: 100 }] }] }] },
      refs,
      targets,
      2,
    );
    expect(draft.discrepancies.some((d) => d.startsWith("Dag 1: Energi"))).toBe(true);
    expect(draft.discrepancies).toContain("Dag 2 saknar måltider.");
  });

  it("builds a create_meal_plan payload with per-day positions", () => {
    const payload = toCreatePlanPayload(
      {
        name: "AI-plan",
        startDate: "2026-10-20",
        numDays: 1,
        meals: [
          { dayIndex: 0, name: "A", slot: "breakfast", time: null, prepMinutes: null, instructions: "", ingredients: [{ foodId: oats.id, quantityG: 50 }] },
          { dayIndex: 0, name: "B", slot: "lunch", time: "12:00", prepMinutes: 10, instructions: "", ingredients: [{ foodId: milk.id, quantityG: 200 }] },
        ],
      },
      { model: "test" },
    );
    expect(payload.source).toBe("ai");
    expect(payload.meals.map((m) => m.position)).toEqual([0, 1]);
    expect(payload.meals[0].ingredients[0]).toEqual({ food_id: oats.id, quantity_g: 50, position: 0 });
  });
});
