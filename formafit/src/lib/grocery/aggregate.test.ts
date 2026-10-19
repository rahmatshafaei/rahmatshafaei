import { describe, expect, it } from "vitest";
import { aggregateGroceries, groceryKey, groceryListToText, normalizeIdentity, roundShoppingQuantity, type GrocerySourceItem } from "./aggregate";

const item = (overrides: Partial<GrocerySourceItem>): GrocerySourceItem => ({
  foodId: "f1",
  name: "Kycklingbröstfilé, rå",
  canonicalName: "kycklingbröstfilé",
  category: "meat_fish",
  preparation: "raw",
  quantity: 100,
  unit: "g",
  ...overrides,
});

describe("normalizeIdentity", () => {
  it("normalises case, punctuation and whitespace but keeps Swedish letters", () => {
    expect(normalizeIdentity("  Gul  Lök, ")).toBe("gul lök");
    expect(normalizeIdentity("ÄGG")).toBe("ägg");
    // Decomposed "ö" (o + combining diaeresis) equals the precomposed form.
    expect(normalizeIdentity("lök")).toBe(normalizeIdentity("lök"));
  });
});

describe("aggregateGroceries", () => {
  it("sums identical ingredients across meals", () => {
    const result = aggregateGroceries([item({ quantity: 125 }), item({ quantity: 150 }), item({ quantity: 125.4 })]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(401);
    expect(result[0].occurrences).toBe(3);
  });

  it("groups different food records with the same canonical identity", () => {
    const result = aggregateGroceries([item({ foodId: "a" }), item({ foodId: "b", name: "kycklingbröstfilé" })]);
    expect(result).toHaveLength(1);
    expect(result[0].foodIds).toEqual(["a", "b"]);
  });

  it("keeps raw and cooked versions separate", () => {
    const result = aggregateGroceries([
      item({ name: "Jasminris, okokt", canonicalName: "jasminris", preparation: "dried", category: "grains" }),
      item({ name: "Jasminris, kokt", canonicalName: "jasminris", preparation: "cooked", category: "grains" }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("never combines incompatible units", () => {
    const result = aggregateGroceries([
      item({ name: "Ägg", canonicalName: "ägg", unit: "g", quantity: 100, category: "dairy" }),
      item({ name: "Ägg", canonicalName: "ägg", unit: "st", quantity: 6, category: "dairy" }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.unit).sort()).toEqual(["g", "st"]);
  });

  it("ignores invalid quantities", () => {
    expect(aggregateGroceries([item({ quantity: 0 }), item({ quantity: Number.NaN })])).toEqual([]);
  });

  it("sorts by store category order, then name", () => {
    const result = aggregateGroceries([
      item({ name: "Banan", canonicalName: "banan", category: "produce", preparation: "as_sold" }),
      item({ name: "Mjölk", canonicalName: "mjölk", category: "dairy", preparation: "as_sold" }),
      item({ name: "Lax", canonicalName: "lax", category: "meat_fish" }),
    ]);
    expect(result.map((r) => r.category)).toEqual(["meat_fish", "dairy", "produce"]);
  });

  it("builds stable keys", () => {
    expect(groceryKey(item({}))).toBe("kycklingbröstfilé|raw|g");
  });
});

describe("rounding and export", () => {
  it("rounds shopping quantities up without floating point artefacts", () => {
    expect(roundShoppingQuantity(0.1 + 0.2 + 99.7, "g")).toBe(100);
    expect(roundShoppingQuantity(100.2, "g")).toBe(101);
    expect(roundShoppingQuantity(2.0000000001, "st")).toBe(2);
  });

  it("exports a readable text list", () => {
    const text = groceryListToText("Vecka 42", [
      { name: "Lax", category: "meat_fish", quantity: 250, unit: "g", is_purchased: true, preparation: "raw" },
      { name: "Havregryn", category: "grains", quantity: 1200, unit: "g", preparation: "dried" },
    ]);
    expect(text).toContain("Kött och fisk");
    expect(text).toContain("[x] Lax (rå vikt) – 250 g");
    expect(text).toContain("[ ] Havregryn (torr vikt) – 1,2 kg");
  });
});
