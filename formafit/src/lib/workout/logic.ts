/**
 * Workout logging, personal records and progression suggestions.
 *
 * Progression uses conservative double progression: the weight only goes up when every
 * working set reached the top of the rep range and the session did not feel too hard.
 * Suggestions are recommendations shown to the user, never applied automatically.
 */

export interface SetInput {
  weightKg: number | null;
  reps: number | null;
  rir?: number | null;
}

export class SetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetValidationError";
  }
}

export function validateSetInput(input: SetInput, { requireComplete = false } = {}): SetInput {
  const { weightKg, reps, rir } = input;
  if (weightKg !== null) {
    if (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 1000) {
      throw new SetValidationError("Vikten måste vara mellan 0 och 1000 kg.");
    }
    if (Math.round(weightKg * 100) !== weightKg * 100) {
      throw new SetValidationError("Vikten kan ha högst två decimaler.");
    }
  }
  if (reps !== null) {
    if (!Number.isInteger(reps) || reps < 0 || reps > 200) {
      throw new SetValidationError("Repetitioner måste vara ett heltal mellan 0 och 200.");
    }
  }
  if (rir !== undefined && rir !== null && (!Number.isInteger(rir) || rir < 0 || rir > 10)) {
    throw new SetValidationError("RIR måste vara ett heltal mellan 0 och 10.");
  }
  if (requireComplete && (weightKg === null || reps === null)) {
    throw new SetValidationError("Ange vikt och repetitioner innan setet markeras som klart.");
  }
  return input;
}

export interface LoggedSet {
  weightKg: number;
  reps: number;
  completed: boolean;
  isWarmup?: boolean;
}

/** Epley estimate of one-repetition maximum. Returns the weight itself for 1 rep. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function setVolume(sets: readonly LoggedSet[]): number {
  return sets.filter((s) => s.completed && !s.isWarmup).reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

export interface HistoricalSet extends LoggedSet {
  date: string; // ISO date
  sessionId: string;
}

export interface PersonalRecords {
  heaviestWeight: { weightKg: number; reps: number; date: string } | null;
  bestEstimated1RM: { value: number; weightKg: number; reps: number; date: string } | null;
  bestSessionVolume: { value: number; date: string } | null;
}

export function personalRecords(history: readonly HistoricalSet[]): PersonalRecords {
  const working = history.filter((s) => s.completed && !s.isWarmup && s.reps > 0);
  let heaviest: PersonalRecords["heaviestWeight"] = null;
  let best1rm: PersonalRecords["bestEstimated1RM"] = null;
  for (const s of working) {
    if (!heaviest || s.weightKg > heaviest.weightKg || (s.weightKg === heaviest.weightKg && s.reps > heaviest.reps)) {
      heaviest = { weightKg: s.weightKg, reps: s.reps, date: s.date };
    }
    const e = estimateOneRepMax(s.weightKg, s.reps);
    if (!best1rm || e > best1rm.value) best1rm = { value: e, weightKg: s.weightKg, reps: s.reps, date: s.date };
  }
  const bySession = new Map<string, { volume: number; date: string }>();
  for (const s of working) {
    const cur = bySession.get(s.sessionId) ?? { volume: 0, date: s.date };
    cur.volume += s.weightKg * s.reps;
    bySession.set(s.sessionId, cur);
  }
  let bestVolume: PersonalRecords["bestSessionVolume"] = null;
  for (const v of bySession.values()) {
    if (!bestVolume || v.volume > bestVolume.value) bestVolume = { value: v.volume, date: v.date };
  }
  return { heaviestWeight: heaviest, bestEstimated1RM: best1rm, bestSessionVolume: bestVolume };
}

/** True when a newly completed set beats the previous best estimated 1RM. */
export function isNewRecord(set: LoggedSet, previous: PersonalRecords): boolean {
  if (!set.completed || set.isWarmup || set.reps <= 0) return false;
  const e = estimateOneRepMax(set.weightKg, set.reps);
  return previous.bestEstimated1RM === null ? false : e > previous.bestEstimated1RM.value + 1e-9;
}

export type SessionFeedback = "too_easy" | "just_right" | "too_hard";

export interface ProgressionInput {
  repMin: number;
  repMax: number;
  /** Working sets from the most recent session of this exercise. */
  lastSets: readonly LoggedSet[];
  /** Working sets from the session before that (used to detect repeated misses). */
  previousSets?: readonly LoggedSet[];
  feedback?: SessionFeedback | null;
  incrementKg?: number;
}

export interface ProgressionSuggestion {
  action: "increase" | "hold" | "reduce" | "no_data";
  suggestedWeightKg: number | null;
  message: string;
}

function roundToIncrement(weight: number, increment: number) {
  return Math.round(weight / increment) * increment;
}

export function suggestProgression(input: ProgressionInput): ProgressionSuggestion {
  const increment = input.incrementKg ?? 2.5;
  const working = input.lastSets.filter((s) => s.completed && !s.isWarmup);
  if (working.length === 0) {
    return { action: "no_data", suggestedWeightKg: null, message: "Ingen tidigare data – välj en vikt du klarar med god teknik." };
  }
  const topWeight = Math.max(...working.map((s) => s.weightKg));
  const atTop = working.filter((s) => s.weightKg === topWeight);
  const allHitTop = atTop.every((s) => s.reps >= input.repMax);
  const missedMin = atTop.filter((s) => s.reps < input.repMin).length;

  if (input.feedback === "too_hard" && missedMin > 0) {
    const reduced = Math.max(0, roundToIncrement(topWeight * 0.9, increment));
    return {
      action: "reduce",
      suggestedWeightKg: reduced,
      message: `Förra passet kändes för tungt och du nådde inte ${input.repMin} reps. Överväg ${formatKg(reduced)} och bygg upp igen.`,
    };
  }

  if (missedMin > 0) {
    const previousWorking = (input.previousSets ?? []).filter((s) => s.completed && !s.isWarmup && s.weightKg === topWeight);
    const missedTwice = previousWorking.length > 0 && previousWorking.some((s) => s.reps < input.repMin);
    if (missedTwice) {
      const reduced = Math.max(0, roundToIncrement(topWeight * 0.9, increment));
      return {
        action: "reduce",
        suggestedWeightKg: reduced,
        message: `Två pass i rad under ${input.repMin} reps på ${formatKg(topWeight)}. En sänkning till ${formatKg(reduced)} kan hjälpa dig att komma vidare.`,
      };
    }
    return {
      action: "hold",
      suggestedWeightKg: topWeight,
      message: `Behåll ${formatKg(topWeight)} och sikta på minst ${input.repMin} reps i alla set.`,
    };
  }

  if (allHitTop && input.feedback !== "too_hard") {
    const next = topWeight + increment;
    return {
      action: "increase",
      suggestedWeightKg: next,
      message: `Alla set nådde ${input.repMax} reps. Förslag: prova ${formatKg(next)} nästa gång (+${formatKg(increment)}).`,
    };
  }

  return {
    action: "hold",
    suggestedWeightKg: topWeight,
    message: `Behåll ${formatKg(topWeight)} och försök öka antalet reps mot ${input.repMax}.`,
  };
}

export function formatKg(kg: number): string {
  return `${kg.toLocaleString("sv-SE", { maximumFractionDigits: 2 })} kg`;
}

/** Active training time in seconds, excluding pauses. */
export function activeDurationSeconds(session: {
  started_at: string;
  completed_at?: string | null;
  paused_at?: string | null;
  paused_seconds: number;
  status: string;
}, now = new Date()): number {
  const start = new Date(session.started_at).getTime();
  const end =
    session.status === "completed" && session.completed_at
      ? new Date(session.completed_at).getTime()
      : session.status === "paused" && session.paused_at
        ? new Date(session.paused_at).getTime()
        : now.getTime();
  return Math.max(0, Math.round((end - start) / 1000) - session.paused_seconds);
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const WEEKDAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"] as const;
export const WEEKDAYS_SHORT = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"] as const;

/** ISO weekday 1 (Monday) – 7 (Sunday) for a YYYY-MM-DD date string. */
export function isoWeekday(isoDate: string): number {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

/** Weekly training consistency: completed sessions per ISO week for the last n weeks. */
export function weeklyConsistency(
  completedDates: readonly string[],
  today: string,
  weeks = 8,
): { weekStart: string; count: number }[] {
  const mondayOf = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (isoWeekday(iso) - 1));
    return d.toISOString().slice(0, 10);
  };
  const current = mondayOf(today);
  const result: { weekStart: string; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${current}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const weekStart = d.toISOString().slice(0, 10);
    result.push({ weekStart, count: 0 });
  }
  const index = new Map(result.map((r, i) => [r.weekStart, i]));
  for (const date of completedDates) {
    const i = index.get(mondayOf(date));
    if (i !== undefined) result[i].count += 1;
  }
  return result;
}
