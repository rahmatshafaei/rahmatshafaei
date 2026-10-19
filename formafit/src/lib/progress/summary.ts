/**
 * Progress summaries computed strictly from recorded data. Nothing is interpolated or
 * inferred: weeks without records are reported as missing, not estimated.
 */
import { addDays, mondayOf } from "@/lib/dates";

export interface WeightPoint {
  date: string;
  weightKg: number;
}

export interface WeeklyAverage {
  weekStart: string;
  average: number;
  count: number;
}

export function weeklyWeightAverages(points: readonly WeightPoint[]): WeeklyAverage[] {
  const groups = new Map<string, number[]>();
  for (const p of points) {
    const key = mondayOf(p.date);
    groups.set(key, [...(groups.get(key) ?? []), p.weightKg]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, values]) => ({
      weekStart,
      average: values.reduce((s, v) => s + v, 0) / values.length,
      count: values.length,
    }));
}

export interface DayIntake {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface WeeklySummaryInput {
  weekStart: string;
  intake: readonly DayIntake[];
  weights: readonly WeightPoint[];
  previousWeekWeights: readonly WeightPoint[];
  completedWorkouts: number;
  scheduledWorkouts: number | null;
  calorieTarget: number | null;
  proteinTarget: number | null;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  loggedDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  avgWeight: number | null;
  weightChange: number | null;
  completedWorkouts: number;
  scheduledWorkouts: number | null;
  highlights: string[];
  hasEnoughData: boolean;
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function buildWeeklySummary(input: WeeklySummaryInput): WeeklySummary {
  const weekEnd = addDays(input.weekStart, 6);
  const inWeek = (d: string) => d >= input.weekStart && d <= weekEnd;
  const days = input.intake.filter((d) => inWeek(d.date) && d.kcal > 0);
  const weights = input.weights.filter((w) => inWeek(w.date));
  const avgKcal = avg(days.map((d) => d.kcal));
  const avgProtein = avg(days.map((d) => d.protein));
  const avgWeight = avg(weights.map((w) => w.weightKg));
  const prevAvg = avg(input.previousWeekWeights.map((w) => w.weightKg));
  const weightChange = avgWeight !== null && prevAvg !== null ? avgWeight - prevAvg : null;

  const highlights: string[] = [];
  if (days.length > 0) {
    highlights.push(`Du loggade mat ${days.length} av 7 dagar.`);
    if (avgKcal !== null && input.calorieTarget) {
      const pct = Math.round((avgKcal / input.calorieTarget) * 100);
      highlights.push(`Genomsnittligt intag de loggade dagarna: ${Math.round(avgKcal)} kcal (${pct} % av målet).`);
    }
    if (avgProtein !== null && input.proteinTarget) {
      highlights.push(`Protein i snitt ${Math.round(avgProtein)} g av målet ${Math.round(input.proteinTarget)} g.`);
    }
  }
  if (weightChange !== null) {
    const sign = weightChange > 0 ? "+" : "";
    highlights.push(
      `Veckosnittet för vikten ändrades ${sign}${weightChange.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} kg jämfört med förra veckan.`,
    );
  } else if (avgWeight !== null) {
    highlights.push("Väg dig även nästa vecka för att se en trend.");
  }
  if (input.completedWorkouts > 0) {
    highlights.push(
      input.scheduledWorkouts
        ? `${input.completedWorkouts} av ${input.scheduledWorkouts} schemalagda pass genomförda.`
        : `${input.completedWorkouts} genomförda pass.`,
    );
  }

  return {
    weekStart: input.weekStart,
    weekEnd,
    loggedDays: days.length,
    avgKcal,
    avgProtein,
    avgWeight,
    weightChange,
    completedWorkouts: input.completedWorkouts,
    scheduledWorkouts: input.scheduledWorkouts,
    highlights,
    hasEnoughData: days.length > 0 || weights.length > 0 || input.completedWorkouts > 0,
  };
}
