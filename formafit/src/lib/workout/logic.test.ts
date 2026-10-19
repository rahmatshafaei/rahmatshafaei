import { describe, expect, it } from "vitest";
import {
  activeDurationSeconds,
  estimateOneRepMax,
  isNewRecord,
  isoWeekday,
  personalRecords,
  resolveCompletedAt,
  SetValidationError,
  setVolume,
  suggestProgression,
  validateSetInput,
  weeklyConsistency,
} from "./logic";

describe("set logging validation", () => {
  it("accepts valid sets", () => {
    expect(validateSetInput({ weightKg: 82.5, reps: 8, rir: 2 })).toEqual({ weightKg: 82.5, reps: 8, rir: 2 });
    expect(validateSetInput({ weightKg: 0, reps: 12 })).toBeTruthy();
  });

  it.each([
    [{ weightKg: -5, reps: 5 }],
    [{ weightKg: 1001, reps: 5 }],
    [{ weightKg: 50, reps: 5.5 }],
    [{ weightKg: 50, reps: -1 }],
    [{ weightKg: 50.123, reps: 5 }],
    [{ weightKg: 50, reps: 5, rir: 11 }],
  ])("rejects %j", (input) => {
    expect(() => validateSetInput(input)).toThrow(SetValidationError);
  });

  it("requires weight and reps to complete a set", () => {
    expect(() => validateSetInput({ weightKg: null, reps: 8 }, { requireComplete: true })).toThrow(SetValidationError);
    expect(() => validateSetInput({ weightKg: 40, reps: null }, { requireComplete: true })).toThrow(SetValidationError);
  });
});

describe("records and volume", () => {
  const history = [
    { sessionId: "s1", date: "2026-10-01", weightKg: 100, reps: 5, completed: true },
    { sessionId: "s1", date: "2026-10-01", weightKg: 100, reps: 5, completed: true },
    { sessionId: "s2", date: "2026-10-08", weightKg: 105, reps: 3, completed: true },
    { sessionId: "s2", date: "2026-10-08", weightKg: 120, reps: 1, completed: false },
    { sessionId: "s2", date: "2026-10-08", weightKg: 60, reps: 10, completed: true, isWarmup: true },
  ];

  it("ignores incomplete and warm-up sets", () => {
    const pr = personalRecords(history);
    expect(pr.heaviestWeight).toEqual({ weightKg: 105, reps: 3, date: "2026-10-08" });
    expect(pr.bestEstimated1RM?.value).toBeCloseTo(100 * (1 + 5 / 30), 10);
    expect(pr.bestSessionVolume).toEqual({ value: 1000, date: "2026-10-01" });
  });

  it("estimates 1RM with Epley", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.333, 2);
    expect(estimateOneRepMax(0, 10)).toBe(0);
  });

  it("detects new records", () => {
    const pr = personalRecords(history);
    expect(isNewRecord({ weightKg: 110, reps: 5, completed: true }, pr)).toBe(true);
    expect(isNewRecord({ weightKg: 90, reps: 5, completed: true }, pr)).toBe(false);
    expect(isNewRecord({ weightKg: 200, reps: 5, completed: false }, pr)).toBe(false);
  });

  it("computes volume from completed working sets", () => {
    expect(setVolume(history)).toBe(100 * 5 * 2 + 105 * 3);
  });
});

describe("progression suggestions", () => {
  const sets = (weight: number, reps: number[]) => reps.map((r) => ({ weightKg: weight, reps: r, completed: true }));

  it("suggests an increase when every set hit the top of the range", () => {
    const s = suggestProgression({ repMin: 8, repMax: 10, lastSets: sets(60, [10, 10, 10]) });
    expect(s.action).toBe("increase");
    expect(s.suggestedWeightKg).toBe(62.5);
  });

  it("does not increase when the session felt too hard", () => {
    const s = suggestProgression({ repMin: 8, repMax: 10, lastSets: sets(60, [10, 10, 10]), feedback: "too_hard" });
    expect(s.action).toBe("hold");
  });

  it("holds after a single miss", () => {
    const s = suggestProgression({ repMin: 8, repMax: 10, lastSets: sets(60, [9, 8, 7]) });
    expect(s.action).toBe("hold");
    expect(s.suggestedWeightKg).toBe(60);
  });

  it("suggests a reduction after repeated misses", () => {
    const s = suggestProgression({
      repMin: 8,
      repMax: 10,
      lastSets: sets(60, [8, 7, 6]),
      previousSets: sets(60, [8, 7, 7]),
    });
    expect(s.action).toBe("reduce");
    expect(s.suggestedWeightKg).toBe(55);
  });

  it("handles missing history", () => {
    expect(suggestProgression({ repMin: 8, repMax: 12, lastSets: [] }).action).toBe("no_data");
  });

  it("respects custom increments", () => {
    const s = suggestProgression({ repMin: 10, repMax: 12, lastSets: sets(14, [12, 12]), incrementKg: 2 });
    expect(s.suggestedWeightKg).toBe(16);
  });
});

describe("session timing and consistency", () => {
  it("excludes paused time", () => {
    const seconds = activeDurationSeconds({
      started_at: "2026-10-19T10:00:00Z",
      completed_at: "2026-10-19T11:00:00Z",
      paused_seconds: 600,
      status: "completed",
    });
    expect(seconds).toBe(3000);
  });

  it("freezes the clock while paused", () => {
    const seconds = activeDurationSeconds(
      { started_at: "2026-10-19T10:00:00Z", paused_at: "2026-10-19T10:20:00Z", paused_seconds: 0, status: "paused" },
      new Date("2026-10-19T12:00:00Z"),
    );
    expect(seconds).toBe(1200);
  });

  it("counts completed sessions per ISO week", () => {
    expect(isoWeekday("2026-10-19")).toBe(1);
    expect(isoWeekday("2026-10-25")).toBe(7);
    const weeks = weeklyConsistency(["2026-10-19", "2026-10-21", "2026-10-14"], "2026-10-22", 3);
    expect(weeks).toEqual([
      { weekStart: "2026-10-05", count: 0 },
      { weekStart: "2026-10-12", count: 1 },
      { weekStart: "2026-10-19", count: 2 },
    ]);
  });
});

describe("completion time of sets synced later", () => {
  const started = "2026-10-19T17:00:00.000Z";
  const now = new Date("2026-10-19T18:00:00.000Z");

  it("keeps the device time when it lies within the session", () => {
    expect(resolveCompletedAt("2026-10-19T17:20:00.000Z", started, now)).toBe("2026-10-19T17:20:00.000Z");
  });

  it("clamps future times and rejects times before the start", () => {
    expect(resolveCompletedAt("2026-10-19T19:00:00.000Z", started, now)).toBe(now.toISOString());
    expect(resolveCompletedAt("2026-10-19T16:59:00.000Z", started, now)).toBe(now.toISOString());
  });

  it("uses the server time when no device time is given", () => {
    expect(resolveCompletedAt(null, started, now)).toBe(now.toISOString());
    expect(resolveCompletedAt("not a date", started, now)).toBe(now.toISOString());
  });
});
