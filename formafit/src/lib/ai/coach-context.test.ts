import { describe, expect, it } from "vitest";
import { buildContextText, relevantTopics } from "./coach-context";

const profile = { goal: "fettminskning", experience: "van", allergies: ["laktos"], dietPreferences: [], targets: { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 } };

describe("relevantTopics", () => {
  it("detects nutrition, training and progress questions", () => {
    expect(relevantTopics("Hur mycket protein bör jag äta?")).toEqual(["nutrition"]);
    expect(relevantTopics("Hur ska jag öka i bänkpress?")).toEqual(["training"]);
    expect(relevantTopics("Hur har min vikt utvecklats?")).toEqual(["progress"]);
    expect(relevantTopics("Vad är kreatin?")).toEqual([]);
    // Words starting with å/ä/ö must be recognised too.
    expect(relevantTopics("Vad ska jag äta efter träningen?")).toEqual(["nutrition", "training"]);
  });
});

describe("buildContextText", () => {
  it("includes only the requested data sections", () => {
    const text = buildContextText(profile, { nutrition: { days: 7, avgKcal: 1900, avgProtein: 140, loggedDays: 5 } }, true);
    expect(text).toContain("snitt 1900 kcal");
    expect(text).not.toContain("Vägningar");
    expect(text).not.toContain("Genomförda pass");
  });

  it("never includes logs when sharing is disabled", () => {
    const text = buildContextText(profile, { progress: { weights: [{ date: "2026-10-01", weightKg: 80 }] } }, false);
    expect(text).not.toContain("80 kg");
    expect(text).toContain("valt att inte dela");
  });

  it("states missing data explicitly instead of inventing it", () => {
    const text = buildContextText(profile, { training: { sessions: [], activeProgram: null }, progress: { weights: [] } }, true);
    expect(text).toContain("Inga genomförda pass");
    expect(text).toContain("Inga vägningar loggade");
  });
});
