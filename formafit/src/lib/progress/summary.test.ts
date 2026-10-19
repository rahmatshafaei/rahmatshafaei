import { describe, expect, it } from "vitest";
import { buildWeeklySummary, weeklyWeightAverages } from "./summary";
import { addDays, isIsoDate, mondayOf, todayIso } from "@/lib/dates";

describe("dates", () => {
  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
  });

  it("uses the Stockholm calendar day", () => {
    // 23:30 UTC on 19 Oct is already 20 Oct in Stockholm (UTC+2).
    expect(todayIso(new Date("2026-10-19T23:30:00Z"))).toBe("2026-10-20");
  });

  it("handles week boundaries", () => {
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("weekly averages", () => {
  it("averages only recorded weigh-ins", () => {
    const result = weeklyWeightAverages([
      { date: "2026-10-19", weightKg: 80 },
      { date: "2026-10-21", weightKg: 79 },
      { date: "2026-10-27", weightKg: 78.5 },
    ]);
    expect(result).toEqual([
      { weekStart: "2026-10-19", average: 79.5, count: 2 },
      { weekStart: "2026-10-26", average: 78.5, count: 1 },
    ]);
  });
});

describe("weekly summary", () => {
  const base = {
    weekStart: "2026-10-19",
    intake: [],
    weights: [],
    previousWeekWeights: [],
    completedWorkouts: 0,
    scheduledWorkouts: null,
    calorieTarget: 2000,
    proteinTarget: 150,
  };

  it("reports insufficient data instead of inventing values", () => {
    const s = buildWeeklySummary(base);
    expect(s.hasEnoughData).toBe(false);
    expect(s.avgKcal).toBeNull();
    expect(s.weightChange).toBeNull();
    expect(s.highlights).toEqual([]);
  });

  it("summarises only days that were logged", () => {
    const s = buildWeeklySummary({
      ...base,
      intake: [
        { date: "2026-10-19", kcal: 1900, protein: 140, carbs: 200, fat: 60 },
        { date: "2026-10-20", kcal: 2100, protein: 160, carbs: 210, fat: 70 },
        { date: "2026-10-26", kcal: 5000, protein: 10, carbs: 10, fat: 10 },
      ],
      weights: [{ date: "2026-10-20", weightKg: 80 }],
      previousWeekWeights: [{ date: "2026-10-13", weightKg: 80.6 }],
      completedWorkouts: 3,
      scheduledWorkouts: 4,
    });
    expect(s.loggedDays).toBe(2);
    expect(s.avgKcal).toBe(2000);
    expect(s.weightChange).toBeCloseTo(-0.6, 10);
    expect(s.highlights).toContain("3 av 4 schemalagda pass genomförda.");
  });
});
