import "server-only";
import type { AuthContext } from "@/lib/auth";
import { addDays, isoDateOf, mondayOf } from "@/lib/dates";
import { signedUrls } from "@/lib/services/storage";
import type { Tables } from "@/lib/supabase/database.types";
import { personalRecords, suggestProgression, type HistoricalSet, type LoggedSet } from "@/lib/workout/logic";

export type ExerciseRow = Tables<"exercises">;

export interface ExerciseSummary {
  id: string;
  name: string;
  slug: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string;
  mechanics: string;
  instructions: string[];
  tips: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  videoUrl: string | null;
  isOwn: boolean;
}

export async function summarizeExercises(auth: AuthContext, rows: ExerciseRow[]): Promise<ExerciseSummary[]> {
  const urls = await signedUrls(auth, "user-media", rows.map((r) => r.image_path));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    primaryMuscles: r.primary_muscles,
    secondaryMuscles: r.secondary_muscles,
    equipment: r.equipment,
    mechanics: r.mechanics,
    instructions: r.instructions,
    tips: r.tips,
    imageUrl: (r.image_path ? urls.get(r.image_path) : null) ?? r.image_url ?? null,
    imageCredit: r.image_path ? "Egen bild" : r.image_credit,
    videoUrl: r.video_url,
    isOwn: r.owner_id === auth.userId,
  }));
}

export async function listExercises(auth: AuthContext, filters: { q?: string; muscle?: string; equipment?: string } = {}) {
  let query = auth.supabase.from("exercises").select("*").eq("is_archived", false).order("name").limit(300);
  if (filters.q) query = query.ilike("name", `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (filters.muscle) query = query.or(`primary_muscles.cs.{${filters.muscle}},secondary_muscles.cs.{${filters.muscle}}`);
  if (filters.equipment) query = query.eq("equipment", filters.equipment);
  const { data, error } = await query;
  if (error) throw error;
  return summarizeExercises(auth, data ?? []);
}

export async function getProgramDetail(auth: AuthContext, programId: string) {
  const { data: program, error } = await auth.supabase
    .from("workout_programs")
    .select("*, program_days(*, program_exercises(*))")
    .eq("id", programId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) throw error;
  if (!program) return null;
  const exerciseIds = program.program_days.flatMap((d) => d.program_exercises.map((e) => e.exercise_id));
  const { data: exRows } = exerciseIds.length
    ? await auth.supabase.from("exercises").select("*").in("id", [...new Set(exerciseIds)])
    : { data: [] as ExerciseRow[] };
  const exercises = await summarizeExercises(auth, exRows ?? []);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const days = program.program_days
    .sort((a, b) => a.position - b.position)
    .map((d) => ({
      ...d,
      exercises: d.program_exercises
        .sort((a, b) => a.position - b.position)
        .filter((e) => byId.has(e.exercise_id))
        .map((e) => ({ ...e, exercise: byId.get(e.exercise_id)! })),
    }));
  return { program, days };
}

export type ProgramDetail = NonNullable<Awaited<ReturnType<typeof getProgramDetail>>>;

export async function getOpenSession(auth: AuthContext) {
  const { data } = await auth.supabase
    .from("workout_sessions")
    .select("id, name, status, started_at, paused_at, paused_seconds")
    .eq("user_id", auth.userId)
    .in("status", ["in_progress", "paused"])
    .maybeSingle();
  return data;
}

/** Completed working sets for exercises, newest first, from completed sessions only. */
export async function getExerciseHistory(auth: AuthContext, exerciseIds: string[], excludeSessionId?: string, limit = 400) {
  if (!exerciseIds.length) return new Map<string, HistoricalSet[]>();
  const { data, error } = await auth.supabase
    .from("session_sets")
    .select("weight_kg, reps, is_completed, is_warmup, session_id, session_exercises!inner(exercise_id), workout_sessions!inner(status, completed_at, started_at)")
    .eq("user_id", auth.userId)
    .eq("is_completed", true)
    .eq("workout_sessions.status", "completed")
    .in("session_exercises.exercise_id", exerciseIds)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const map = new Map<string, HistoricalSet[]>();
  for (const row of data ?? []) {
    if (row.session_id === excludeSessionId) continue;
    const exId = row.session_exercises.exercise_id;
    const date = isoDateOf(row.workout_sessions.completed_at ?? row.workout_sessions.started_at);
    const list = map.get(exId) ?? [];
    list.push({ weightKg: Number(row.weight_kg), reps: row.reps ?? 0, completed: true, isWarmup: row.is_warmup, date, sessionId: row.session_id });
    map.set(exId, list);
  }
  return map;
}

function groupBySession(sets: HistoricalSet[]) {
  const sessions: { sessionId: string; date: string; sets: LoggedSet[] }[] = [];
  for (const s of sets) {
    let group = sessions.find((g) => g.sessionId === s.sessionId);
    if (!group) {
      group = { sessionId: s.sessionId, date: s.date, sets: [] };
      sessions.push(group);
    }
    group.sets.push(s);
  }
  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getSessionDetail(auth: AuthContext, sessionId: string) {
  const { data: session, error } = await auth.supabase
    .from("workout_sessions")
    .select("*, session_exercises(*, session_sets(*))")
    .eq("id", sessionId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;
  const exerciseIds = [...new Set(session.session_exercises.map((e) => e.exercise_id))];
  const [{ data: exRows }, history, { data: prefs }, { data: feedbackRows }] = await Promise.all([
    exerciseIds.length ? auth.supabase.from("exercises").select("*").in("id", exerciseIds) : Promise.resolve({ data: [] as ExerciseRow[] }),
    getExerciseHistory(auth, exerciseIds, sessionId),
    auth.supabase.from("user_preferences").select("weight_increment_kg, default_rest_seconds").eq("user_id", auth.userId).single(),
    auth.supabase.from("workout_sessions").select("id, feedback").eq("user_id", auth.userId).eq("status", "completed").order("completed_at", { ascending: false }).limit(30),
  ]);
  const exercises = await summarizeExercises(auth, exRows ?? []);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const feedbackBySession = new Map((feedbackRows ?? []).map((r) => [r.id, r.feedback]));
  const increment = Number(prefs?.weight_increment_kg ?? 2.5);

  const items = session.session_exercises
    .sort((a, b) => a.position - b.position)
    .filter((e) => byId.has(e.exercise_id))
    .map((e) => {
      const hist = history.get(e.exercise_id) ?? [];
      const sessions = groupBySession(hist);
      const last = sessions[0];
      const previous = sessions[1];
      const repMin = e.rep_min ?? 8;
      const repMax = e.rep_max ?? 12;
      return {
        ...e,
        exercise: byId.get(e.exercise_id)!,
        sets: [...e.session_sets].sort((a, b) => a.set_number - b.set_number),
        previous: last ? { date: last.date, sets: last.sets } : null,
        records: personalRecords(hist),
        suggestion: suggestProgression({
          repMin,
          repMax,
          lastSets: last?.sets ?? [],
          previousSets: previous?.sets ?? [],
          feedback: last ? (feedbackBySession.get(last.sessionId) ?? null) : null,
          incrementKg: increment,
        }),
      };
    });
  return { session, exercises: items, defaultRest: prefs?.default_rest_seconds ?? 90 };
}

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof getSessionDetail>>>;

/** This week's schedule for the active program, with completion derived from completed sessions only. */
export async function getWeekSchedule(auth: AuthContext, today: string) {
  const { data: program } = await auth.supabase
    .from("workout_programs")
    .select("id, name, program_days(id, name, weekday, is_rest_day, position, program_exercises(count))")
    .eq("user_id", auth.userId)
    .eq("is_active", true)
    .maybeSingle();
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const { data: sessions } = await auth.supabase
    .from("workout_sessions")
    .select("id, name, program_day_id, completed_at, scheduled_for")
    .eq("user_id", auth.userId)
    .eq("status", "completed")
    .gte("completed_at", `${addDays(weekStart, -1)}T00:00:00Z`)
    .lte("completed_at", `${addDays(weekEnd, 1)}T23:59:59Z`);
  const completed = (sessions ?? [])
    .map((s) => ({ ...s, date: isoDateOf(s.completed_at!) }))
    .filter((s) => s.date >= weekStart && s.date <= weekEnd);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const planned = (program?.program_days ?? []).filter((d) => d.weekday === i + 1).sort((a, b) => a.position - b.position);
    return {
      date,
      weekday: i + 1,
      planned: planned.map((d) => ({
        id: d.id,
        name: d.name,
        isRest: d.is_rest_day,
        exerciseCount: (d.program_exercises as unknown as { count: number }[])[0]?.count ?? 0,
        completedSessionId: completed.find((s) => s.program_day_id === d.id && s.date === date)?.id ?? null,
      })),
      completed: completed.filter((s) => s.date === date),
    };
  });
  return { program: program ? { id: program.id, name: program.name } : null, days, weekStart };
}

/** Whether the active program has at least one training day tied to a weekday (needed for reminders). */
export async function hasScheduledTrainingDays(auth: AuthContext): Promise<boolean> {
  const { data } = await auth.supabase
    .from("program_days")
    .select("id, workout_programs!inner(is_active)")
    .eq("user_id", auth.userId)
    .eq("workout_programs.is_active", true)
    .eq("is_rest_day", false)
    .not("weekday", "is", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}
