/**
 * Pure helpers for AI workout programs. The model chooses exercises only from library
 * candidates (E1, E2 …); values are clamped to safe ranges and every deviation is reported.
 */
import { z } from "zod";

export const aiWorkoutSchema = z.object({
  name: z.string(),
  split_type: z.enum(["push_pull_legs", "upper_lower", "full_body", "bro_split", "custom"]),
  description: z.string(),
  progression: z.string(),
  days: z.array(
    z.object({
      name: z.string(),
      weekday: z.number(),
      is_rest_day: z.boolean(),
      notes: z.string(),
      exercises: z.array(
        z.object({
          ref: z.string(),
          sets: z.number(),
          rep_min: z.number(),
          rep_max: z.number(),
          rest_seconds: z.number(),
          tempo: z.string(),
          superset_group: z.number(),
          notes: z.string(),
        }),
      ),
    }),
  ),
});
export type AiWorkout = z.infer<typeof aiWorkoutSchema>;

export interface CandidateExercise {
  id: string;
  name: string;
  primaryMuscles: string[];
  equipment: string;
}

export interface DraftWorkoutExercise {
  exercise: CandidateExercise;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  tempo: string | null;
  supersetGroup: number | null;
  notes: string;
}

export interface DraftWorkoutDay {
  name: string;
  weekday: number | null;
  isRestDay: boolean;
  notes: string;
  exercises: DraftWorkoutExercise[];
}

export interface WorkoutDraft {
  name: string;
  splitType: AiWorkout["split_type"];
  description: string;
  progression: string;
  days: DraftWorkoutDay[];
  discrepancies: string[];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));
const TEMPO = /^[0-9xX]-?[0-9xX]-?[0-9xX]-?[0-9xX]$/;

export function buildExerciseRefs(exercises: readonly CandidateExercise[]) {
  const map = new Map<string, CandidateExercise>();
  exercises.forEach((e, i) => map.set(`E${i + 1}`, e));
  return map;
}

export function exercisesForPrompt(refs: Map<string, CandidateExercise>) {
  return [...refs.entries()].map(([ref, e]) => `${ref} | ${e.name} | ${e.primaryMuscles.join(", ")} | ${e.equipment}`).join("\n");
}

export function resolveWorkout(output: AiWorkout, refs: Map<string, CandidateExercise>, maxTrainingDays: number): WorkoutDraft {
  const discrepancies: string[] = [];
  const usedWeekdays = new Set<number>();
  let trainingDays = 0;
  const days: DraftWorkoutDay[] = [];
  for (const [i, day] of output.days.entries()) {
    const label = day.name.trim() || `Dag ${i + 1}`;
    let weekday: number | null = Number.isInteger(day.weekday) && day.weekday >= 1 && day.weekday <= 7 ? day.weekday : null;
    if (weekday !== null && usedWeekdays.has(weekday)) {
      discrepancies.push(`${label}: veckodagen användes redan och togs bort.`);
      weekday = null;
    }
    if (weekday !== null) usedWeekdays.add(weekday);
    const exercises: DraftWorkoutExercise[] = [];
    if (!day.is_rest_day) {
      for (const ex of day.exercises) {
        const candidate = refs.get(ex.ref.trim().toUpperCase());
        if (!candidate) {
          discrepancies.push(`${label}: en övning som inte finns i biblioteket (${ex.ref}) togs bort.`);
          continue;
        }
        const repMin = clamp(ex.rep_min, 1, 30);
        const repMax = Math.max(repMin, clamp(ex.rep_max, 1, 30));
        if (ex.sets > 8 || ex.rep_max > 30) discrepancies.push(`${label}: orimliga set/reps för ${candidate.name} justerades.`);
        exercises.push({
          exercise: candidate,
          sets: clamp(ex.sets, 1, 8),
          repMin,
          repMax,
          restSeconds: clamp(ex.rest_seconds, 30, 300),
          tempo: TEMPO.test(ex.tempo.trim()) ? ex.tempo.trim() : null,
          supersetGroup: ex.superset_group >= 1 && ex.superset_group <= 20 ? Math.round(ex.superset_group) : null,
          notes: ex.notes.trim().slice(0, 500),
        });
      }
    }
    const isRest = day.is_rest_day || exercises.length === 0;
    if (!day.is_rest_day && exercises.length === 0) discrepancies.push(`${label}: inga giltiga övningar – dagen blev vilodag.`);
    if (!isRest) {
      trainingDays += 1;
      if (trainingDays > maxTrainingDays) {
        discrepancies.push(`${label}: fler träningsdagar än begärt – dagen togs bort.`);
        continue;
      }
    }
    days.push({ name: label.slice(0, 80), weekday, isRestDay: isRest, notes: day.notes.trim().slice(0, 1000), exercises });
  }
  return {
    name: output.name.trim().slice(0, 120) || "AI-program",
    splitType: output.split_type,
    description: output.description.trim().slice(0, 1500),
    progression: output.progression.trim().slice(0, 2000),
    days,
    discrepancies,
  };
}

export const saveWorkoutSchema = z.object({
  name: z.string().trim().min(1).max(120),
  splitType: z.enum(["push_pull_legs", "upper_lower", "full_body", "bro_split", "custom"]),
  description: z.string().max(4000),
  progression: z.string().max(2000),
  days: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        weekday: z.number().int().min(1).max(7).nullable(),
        isRestDay: z.boolean(),
        notes: z.string().max(2000),
        exercises: z
          .array(
            z.object({
              exerciseId: z.uuid(),
              sets: z.number().int().min(1).max(20),
              repMin: z.number().int().min(1).max(100),
              repMax: z.number().int().min(1).max(100),
              restSeconds: z.number().int().min(0).max(900),
              tempo: z.string().regex(TEMPO).nullable(),
              supersetGroup: z.number().int().min(1).max(20).nullable(),
              notes: z.string().max(1000),
            }),
          )
          .max(15),
      }),
    )
    .min(1)
    .max(14),
});

export function toCreateProgramPayload(input: z.infer<typeof saveWorkoutSchema>) {
  return {
    name: input.name,
    split_type: input.splitType,
    description: [input.description, input.progression ? `Progression: ${input.progression}` : ""].filter(Boolean).join("\n\n"),
    source: "ai",
    generation_meta: { progression: input.progression, generated_at: new Date().toISOString() },
    days: input.days.map((d, position) => ({
      position,
      name: d.name,
      weekday: d.weekday,
      is_rest_day: d.isRestDay,
      notes: d.notes || null,
      exercises: d.isRestDay
        ? []
        : d.exercises.map((e, i) => ({
            exercise_id: e.exerciseId,
            position: i,
            sets: e.sets,
            rep_min: e.repMin,
            rep_max: Math.max(e.repMin, e.repMax),
            rest_seconds: e.restSeconds,
            tempo: e.tempo,
            superset_group: e.supersetGroup,
            notes: e.notes || null,
          })),
    })),
  };
}
