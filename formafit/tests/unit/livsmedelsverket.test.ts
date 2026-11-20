// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { categoryFor, extractMacros, preparationFor, toFoodRow, toMigrationSql } from "../../scripts/lib/livsmedelsverket.mjs";

const fixture = (name: string) => JSON.parse(readFileSync(path.resolve(__dirname, "../fixtures/livsmedelsverket", name), "utf8"));
const page = fixture("livsmedel-page.json");
const nutrients = fixture("naringsvarden-1.json");

describe("Livsmedelsverket import mapping", () => {
  it("copies energy and macros per 100 g from the real API response", () => {
    expect(extractMacros(nutrients)).toEqual({ kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 });
  });

  it("converts kJ only when no kcal value is published, and keeps missing values unknown", () => {
    const kjOnly = nutrients.filter((n: { enhet: string }) => n.enhet !== "kcal");
    expect(extractMacros(kjOnly).kcal).toBe(884.3);
    const noFiber = nutrients.filter((n: { euroFIRkod: string }) => n.euroFIRkod !== "FIBT");
    expect(extractMacros(noFiber).fiber).toBeNull();
  });

  it("builds a verified reference row with attribution", () => {
    const result = toFoodRow(page.livsmedel[0], nutrients);
    expect(result).toEqual({
      row: {
        name: "Nöt talg",
        canonical_name: "nöt talg",
        category: "meat_fish",
        preparation: "as_sold",
        kcal_per_100g: 884,
        protein_per_100g: 0,
        carbs_per_100g: 0,
        fat_per_100g: 100,
        fiber_per_100g: 0,
        source_ref: "1",
        source_note: "Källa: Livsmedelsverkets livsmedelsdatabas, livsmedelsnummer 1 (uppdaterad 2026-06-29). Licens: CC BY 4.0.",
      },
    });
  });

  it("skips values that do not fit instead of changing them", () => {
    const tooMuch = nutrients.map((n: { euroFIRkod: string; enhet: string }) =>
      n.euroFIRkod === "PROT" ? { ...n, varde: 1 } : n.euroFIRkod === "FAT" ? { ...n, varde: 100 } : n,
    );
    expect(toFoodRow(page.livsmedel[0], tooMuch)).toEqual({ skip: "protein + kolhydrater + fett = 101 g > 100,5 g" });
    expect(toFoodRow(page.livsmedel[0], [])).toEqual({ skip: "inga näringsvärden" });
    expect(toFoodRow({ nummer: 9, namn: " " }, nutrients)).toEqual({ skip: "saknar nummer eller namn" });
  });

  it("groups foods into shopping list sections", () => {
    expect(categoryFor("Nöt talg")).toBe("meat_fish");
    expect(categoryFor("Cashewnötter rostade")).toBe("pantry");
    expect(categoryFor("Laxfilé rå")).toBe("meat_fish");
    expect(categoryFor("Hårdost 28 % fett")).toBe("dairy");
    expect(categoryFor("Havregryn fullkorn")).toBe("grains");
    expect(categoryFor("Blåbär frysta")).toBe("produce");
    expect(categoryFor("Rapsolja")).toBe("pantry");
    expect(categoryFor("Pannkaka")).toBe("other");
  });

  it("derives the preparation state from the name and cooking method", () => {
    expect(preparationFor("Hirs kokt m. salt", "kokt")).toBe("cooked");
    expect(preparationFor("Kycklingbröst rått", null)).toBe("raw");
    expect(preparationFor("Aprikoser torkade", null)).toBe("dried");
    expect(preparationFor("Mjölk 1,5 % fett", null)).toBe("as_sold");
  });

  it("writes an idempotent migration with escaped text and the skip list", () => {
    const row = (toFoodRow({ ...page.livsmedel[0], namn: "Kock's sås" }, nutrients) as { row: Record<string, unknown> }).row;
    const sql = toMigrationSql([row], { retrievedOn: "2026-11-20", apiVersion: "1.0.0", skipped: [{ nummer: 7, namn: "X", reason: "inga näringsvärden" }] });
    expect(sql).toContain("'Kock''s sås'");
    expect(sql).toContain("on conflict (source, source_ref) where owner_id is null and source_ref is not null");
    expect(sql).toContain("'livsmedelsverket', '1', ");
    expect(sql).toContain("'verified')");
    expect(sql).toContain("--   7 X: inga näringsvärden");
    expect(sql).toContain("CC BY 4.0");
  });
});
