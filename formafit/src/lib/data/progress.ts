import "server-only";
import type { AuthContext } from "@/lib/auth";
import { addDays, isoDateOf, mondayOf } from "@/lib/dates";
import { getIntakeRange } from "@/lib/data/diary";
import { buildWeeklySummary, weeklyWeightAverages } from "@/lib/progress/summary";
import { estimateOneRepMax, weeklyConsistency } from "@/lib/workout/logic";

export async function getMeasurements(auth: AuthContext, from?: string) {
  let q = auth.supabase.from("measurements").select("*").eq("user_id", auth.userId).order("measured_on");
  if (from) q = q.gte("measured_on", from);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getCompletedSessions(auth: AuthContext, fromIso: string) {
  const { data, error } = await auth.supabase
    .from("workout_sessions")
    .select("id, name, completed_at")
    .eq("user_id", auth.userId)
    .eq("status", "completed")
    .gte("completed_at", `${fromIso}T00:00:00Z`)
    .order("completed_at");
  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, date: isoDateOf(s.completed_at!) }));
}

/** Estimated 1RM per session for the user's most frequently logged exercises. */
export async function getStrengthSeries(auth: AuthContext, maxExercises = 6) {
  const { data, error } = await auth.supabase
    .from("session_sets")
    .select("weight_kg, reps, is_warmup, session_id, session_exercises!inner(exercise_id, exercises(name)), workout_sessions!inner(status, completed_at)")
    .eq("user_id", auth.userId)
    .eq("is_completed", true)
    .eq("workout_sessions.status", "completed")
    .order("completed_at", { ascending: true })
    .limit(3000);
  if (error) throw error;
  const byExercise = new Map<string, { name: string; sessions: Map<string, { date: string; e1rm: number }> }>();
  for (const row of data ?? []) {
    if (row.is_warmup || !row.reps) continue;
    const id = row.session_exercises.exercise_id;
    const entry = byExercise.get(id) ?? { name: row.session_exercises.exercises?.name ?? "Övning", sessions: new Map() };
    const date = isoDateOf(row.workout_sessions.completed_at!);
    const e = estimateOneRepMax(Number(row.weight_kg), row.reps);
    const cur = entry.sessions.get(row.session_id);
    if (!cur || e > cur.e1rm) entry.sessions.set(row.session_id, { date, e1rm: e });
    byExercise.set(id, entry);
  }
  return [...byExercise.entries()]
    .map(([id, v]) => ({ id, name: v.name, points: [...v.sessions.values()].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ date: p.date, e1rm: Math.round(p.e1rm * 10) / 10 })) }))
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, maxExercises);
}

export async function getProgressOverview(auth: AuthContext, today: string) {
  const from = addDays(today, -55);
  const weekStart = mondayOf(today);
  const [measurements, intake, sessions, targets, program] = await Promise.all([
    getMeasurements(auth, addDays(today, -180)),
    getIntakeRange(auth, from, today),
    getCompletedSessions(auth, addDays(weekStart, -7 * 11)),
    auth.supabase.from("nutrition_targets").select("calories, protein_g, carbs_g, fat_g").eq("user_id", auth.userId).maybeSingle(),
    auth.supabase.from("workout_programs").select("program_days(is_rest_day, weekday)").eq("user_id", auth.userId).eq("is_active", true).maybeSingle(),
  ]);
  const weights = measurements.filter((m) => m.weight_kg !== null).map((m) => ({ date: m.measured_on, weightKg: Number(m.weight_kg) }));
  const scheduledPerWeek = program.data ? program.data.program_days.filter((d) => !d.is_rest_day && d.weekday).length : null;
  const summaryFor = (start: string) =>
    buildWeeklySummary({
      weekStart: start,
      intake,
      weights,
      previousWeekWeights: weights.filter((w) => w.date >= addDays(start, -7) && w.date < start),
      completedWorkouts: sessions.filter((s) => s.date >= start && s.date <= addDays(start, 6)).length,
      scheduledWorkouts: scheduledPerWeek,
      calorieTarget: targets.data?.calories ?? null,
      proteinTarget: targets.data ? Number(targets.data.protein_g) : null,
    });
  return {
    weights,
    weeklyWeights: weeklyWeightAverages(weights),
    intake: intake.slice(-28),
    consistency: weeklyConsistency(sessions.map((s) => s.date), today, 12),
    scheduledPerWeek,
    targets: targets.data,
    thisWeek: summaryFor(weekStart),
    lastWeek: summaryFor(addDays(weekStart, -7)),
  };
}
