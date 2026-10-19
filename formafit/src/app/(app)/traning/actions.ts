"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction, unwrap, UserFacingError } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth";
import { uploadImage } from "@/lib/services/storage";
import type { Json } from "@/lib/supabase/database.types";
import { validateSetInput } from "@/lib/workout/logic";
import { PROGRAM_TEMPLATES } from "@/lib/workout/templates";
import { consumeAiQuota } from "@/lib/ai/rate-limit";
import { generateWorkoutDraft } from "@/lib/ai/workout";
import { saveWorkoutSchema, toCreateProgramPayload } from "@/lib/ai/workout-draft";
import { listExercises } from "@/lib/data/workouts";
import { exerciseSchema, programExerciseSchema, setLogSchema, uuid, workoutGeneratorSchema } from "@/lib/validation";

function revalidateTraining(path?: string) {
  if (path) revalidatePath(path);
  revalidatePath("/traning", "layout");
  revalidatePath("/hem");
}

const splitType = z.enum(["push_pull_legs", "upper_lower", "full_body", "bro_split", "custom"]);

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export async function createProgram(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = z.object({ name: z.string().trim().min(1, "Ange ett namn.").max(120), splitType: splitType.default("custom") }).parse(raw);
    const program = unwrap(
      await supabase.from("workout_programs").insert({ user_id: userId, name: input.name, split_type: input.splitType }).select("id").single(),
    );
    unwrap(await supabase.from("program_days").insert({ program_id: program.id, user_id: userId, position: 0, name: "Dag 1", weekday: 1 }));
    revalidateTraining();
    return { id: program.id };
  });
}

export async function createProgramFromTemplate(rawKey: unknown) {
  return authedAction(async ({ supabase }) => {
    const key = z.string().parse(rawKey);
    const template = PROGRAM_TEMPLATES.find((t) => t.key === key);
    if (!template) throw new UserFacingError("Mallen finns inte.");
    const slugs = [...new Set(template.days.flatMap((d) => d.exercises.map((e) => e.slug)))];
    const exRows = unwrap(await supabase.from("exercises").select("id, slug").is("owner_id", null).in("slug", slugs));
    const bySlug = new Map(exRows.map((e) => [e.slug, e.id]));
    const payload = {
      name: template.name,
      split_type: template.split,
      description: template.description,
      source: "manual",
      days: template.days.map((d, position) => ({
        position,
        name: d.name,
        weekday: d.weekday,
        is_rest_day: Boolean(d.rest),
        exercises: d.exercises
          .filter((e) => bySlug.has(e.slug))
          .map((e, i) => ({
            exercise_id: bySlug.get(e.slug),
            position: i,
            sets: e.sets,
            rep_min: e.repMin,
            rep_max: e.repMax,
            rest_seconds: e.rest,
            superset_group: e.superset ?? null,
          })),
      })),
    };
    const id = unwrap(await supabase.rpc("create_workout_program", { p_program: payload as unknown as Json }));
    revalidateTraining();
    return { id };
  });
}

const programUpdateSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(120),
  splitType,
  description: z.string().trim().max(4000).nullable().optional(),
});

export async function updateProgram(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = programUpdateSchema.parse(raw);
    const rows = unwrap(
      await supabase
        .from("workout_programs")
        .update({ name: input.name, split_type: input.splitType, description: input.description ?? null })
        .eq("id", input.id)
        .eq("user_id", userId)
        .select("id"),
    );
    if (!rows.length) throw new UserFacingError("Programmet hittades inte.");
    revalidateTraining(`/traning/program/${input.id}`);
    return null;
  });
}

export async function deleteProgram(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    // Completed sessions keep their logged sets (program references are set to null).
    unwrap(await supabase.from("workout_programs").delete().eq("id", id).eq("user_id", userId));
    revalidateTraining();
    return null;
  });
}

export async function duplicateProgram(raw: unknown) {
  return authedAction(async ({ supabase }) => {
    const input = z.object({ id: uuid, name: z.string().trim().min(1).max(120) }).parse(raw);
    const id = unwrap(await supabase.rpc("duplicate_workout_program", { p_program_id: input.id, p_name: input.name }));
    revalidateTraining();
    return { id };
  });
}

export async function setActiveProgram(rawId: unknown) {
  return authedAction(async ({ supabase }) => {
    const id = uuid.parse(rawId);
    unwrap(await supabase.rpc("set_active_program", { p_program_id: id }));
    revalidateTraining();
    return null;
  });
}

export async function deactivateProgram(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    unwrap(await supabase.from("workout_programs").update({ is_active: false }).eq("id", id).eq("user_id", userId));
    revalidateTraining();
    return null;
  });
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

async function ownedDay(auth: AuthContext, dayId: string) {
  return unwrap(await auth.supabase.from("program_days").select("id, program_id, position").eq("id", dayId).eq("user_id", auth.userId).single());
}

export async function addDay(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = z.object({ programId: uuid, rest: z.boolean().default(false) }).parse(raw);
    const days = unwrap(await supabase.from("program_days").select("position").eq("program_id", input.programId).eq("user_id", userId));
    const program = unwrap(await supabase.from("workout_programs").select("id").eq("id", input.programId).eq("user_id", userId).single());
    unwrap(
      await supabase.from("program_days").insert({
        program_id: program.id,
        user_id: userId,
        position: days.length ? Math.max(...days.map((d) => d.position)) + 1 : 0,
        name: input.rest ? "Vila" : `Dag ${days.length + 1}`,
        is_rest_day: input.rest,
      }),
    );
    revalidateTraining(`/traning/program/${input.programId}`);
    return null;
  });
}

const dayUpdateSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1, "Ange ett namn.").max(80),
  weekday: z.coerce.number().int().min(0).max(7),
  isRestDay: z.boolean(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function updateDay(raw: unknown) {
  return authedAction(async (auth) => {
    const input = dayUpdateSchema.parse(raw);
    const day = await ownedDay(auth, input.id);
    unwrap(
      await auth.supabase
        .from("program_days")
        .update({ name: input.name, weekday: input.weekday || null, is_rest_day: input.isRestDay, notes: input.notes ?? null })
        .eq("id", input.id)
        .eq("user_id", auth.userId),
    );
    revalidateTraining(`/traning/program/${day.program_id}`);
    return null;
  });
}

export async function deleteDay(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const day = await ownedDay(auth, id);
    unwrap(await auth.supabase.from("program_days").delete().eq("id", id).eq("user_id", auth.userId));
    revalidateTraining(`/traning/program/${day.program_id}`);
    return null;
  });
}

export async function moveDay(rawId: unknown, rawDirection: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const direction = z.enum(["up", "down"]).parse(rawDirection);
    const day = await ownedDay(auth, id);
    const days = unwrap(
      await auth.supabase.from("program_days").select("id, position").eq("program_id", day.program_id).eq("user_id", auth.userId).order("position"),
    );
    const index = days.findIndex((d) => d.id === id);
    const swap = days[direction === "up" ? index - 1 : index + 1];
    if (!swap) return null;
    await Promise.all(
      days.map((d, i) => {
        const pos = d.id === id ? (direction === "up" ? index - 1 : index + 1) : d.id === swap.id ? index : i;
        return auth.supabase.from("program_days").update({ position: pos }).eq("id", d.id).eq("user_id", auth.userId);
      }),
    );
    revalidateTraining(`/traning/program/${day.program_id}`);
    return null;
  });
}

// ---------------------------------------------------------------------------
// Program exercises
// ---------------------------------------------------------------------------

export async function addProgramExercise(raw: unknown) {
  return authedAction(async (auth) => {
    const input = z.object({ dayId: uuid, exerciseId: uuid }).parse(raw);
    const day = await ownedDay(auth, input.dayId);
    const { count } = await auth.supabase.from("program_exercises").select("id", { count: "exact", head: true }).eq("program_day_id", input.dayId);
    const { data: prefs } = await auth.supabase.from("user_preferences").select("default_rest_seconds").eq("user_id", auth.userId).single();
    unwrap(
      await auth.supabase.from("program_exercises").insert({
        program_day_id: input.dayId,
        user_id: auth.userId,
        exercise_id: input.exerciseId,
        position: count ?? 0,
        rest_seconds: prefs?.default_rest_seconds ?? 90,
      }),
    );
    unwrap(await auth.supabase.from("program_days").update({ is_rest_day: false }).eq("id", input.dayId).eq("user_id", auth.userId));
    revalidateTraining(`/traning/program/${day.program_id}`);
    return null;
  });
}

async function ownedProgramExercise(auth: AuthContext, id: string) {
  return unwrap(
    await auth.supabase.from("program_exercises").select("*, program_days(program_id)").eq("id", id).eq("user_id", auth.userId).single(),
  );
}

export async function updateProgramExercise(raw: unknown) {
  return authedAction(async (auth) => {
    const input = programExerciseSchema.parse(raw);
    const pe = await ownedProgramExercise(auth, input.id);
    unwrap(
      await auth.supabase
        .from("program_exercises")
        .update({
          sets: input.sets,
          rep_min: input.repMin,
          rep_max: input.repMax,
          suggested_weight_kg: input.suggestedWeightKg ?? null,
          rest_seconds: input.restSeconds,
          tempo: input.tempo ?? null,
          superset_group: input.supersetGroup ?? null,
          notes: input.notes ?? null,
        })
        .eq("id", input.id)
        .eq("user_id", auth.userId),
    );
    revalidateTraining(`/traning/program/${pe.program_days?.program_id}`);
    return null;
  });
}

export async function duplicateProgramExercise(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const pe = await ownedProgramExercise(auth, id);
    const later = unwrap(
      await auth.supabase.from("program_exercises").select("id, position").eq("program_day_id", pe.program_day_id).gt("position", pe.position),
    );
    await Promise.all(later.map((l) => auth.supabase.from("program_exercises").update({ position: l.position + 1 }).eq("id", l.id).eq("user_id", auth.userId)));
    unwrap(
      await auth.supabase.from("program_exercises").insert({
        program_day_id: pe.program_day_id,
        user_id: auth.userId,
        exercise_id: pe.exercise_id,
        position: pe.position + 1,
        sets: pe.sets,
        rep_min: pe.rep_min,
        rep_max: pe.rep_max,
        suggested_weight_kg: pe.suggested_weight_kg,
        rest_seconds: pe.rest_seconds,
        tempo: pe.tempo,
        superset_group: pe.superset_group,
        notes: pe.notes,
      }),
    );
    revalidateTraining(`/traning/program/${pe.program_days?.program_id}`);
    return null;
  });
}

export async function removeProgramExercise(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const pe = await ownedProgramExercise(auth, id);
    unwrap(await auth.supabase.from("program_exercises").delete().eq("id", id).eq("user_id", auth.userId));
    revalidateTraining(`/traning/program/${pe.program_days?.program_id}`);
    return null;
  });
}

export async function reorderProgramExercises(raw: unknown) {
  return authedAction(async (auth) => {
    const input = z.object({ dayId: uuid, orderedIds: z.array(uuid).max(60) }).parse(raw);
    const day = await ownedDay(auth, input.dayId);
    const existing = unwrap(await auth.supabase.from("program_exercises").select("id").eq("program_day_id", input.dayId).eq("user_id", auth.userId));
    const ids = new Set(existing.map((e) => e.id));
    if (input.orderedIds.length !== ids.size || input.orderedIds.some((id) => !ids.has(id))) throw new UserFacingError("Övningarna har ändrats. Ladda om sidan.");
    await Promise.all(input.orderedIds.map((id, position) => auth.supabase.from("program_exercises").update({ position }).eq("id", id).eq("user_id", auth.userId)));
    revalidateTraining(`/traning/program/${day.program_id}`);
    return null;
  });
}

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "ovning"}-${crypto.randomUUID().slice(0, 6)}`;
}

function parseExerciseForm(formData: FormData) {
  const json = formData.get("data");
  if (typeof json !== "string") throw new UserFacingError("Ogiltigt formulär.");
  return exerciseSchema.parse(JSON.parse(json));
}

export async function createExercise(formData: FormData) {
  return authedAction(async (auth) => {
    const input = parseExerciseForm(formData);
    const image = formData.get("image");
    const imagePath = image instanceof File && image.size > 0 ? await uploadImage(auth, "user-media", "exercises", image) : null;
    const row = unwrap(
      await auth.supabase
        .from("exercises")
        .insert({
          owner_id: auth.userId,
          slug: slugify(input.name),
          name: input.name,
          primary_muscles: input.primaryMuscles,
          secondary_muscles: input.secondaryMuscles,
          equipment: input.equipment,
          mechanics: input.mechanics,
          instructions: input.instructions,
          tips: input.tips ?? null,
          video_url: input.videoUrl ?? null,
          image_path: imagePath,
        })
        .select("id")
        .single(),
    );
    revalidateTraining();
    return { id: row.id };
  });
}

export async function updateExercise(exerciseId: string, formData: FormData) {
  return authedAction(async (auth) => {
    const id = uuid.parse(exerciseId);
    const input = parseExerciseForm(formData);
    const image = formData.get("image");
    const imagePath = image instanceof File && image.size > 0 ? await uploadImage(auth, "user-media", "exercises", image) : undefined;
    const rows = unwrap(
      await auth.supabase
        .from("exercises")
        .update({
          name: input.name,
          primary_muscles: input.primaryMuscles,
          secondary_muscles: input.secondaryMuscles,
          equipment: input.equipment,
          mechanics: input.mechanics,
          instructions: input.instructions,
          tips: input.tips ?? null,
          video_url: input.videoUrl ?? null,
          ...(imagePath ? { image_path: imagePath } : {}),
        })
        .eq("id", id)
        .eq("owner_id", auth.userId)
        .select("id"),
    );
    if (!rows.length) throw new UserFacingError("Du kan bara ändra egna övningar.");
    revalidateTraining(`/traning/ovningar/${id}`);
    return { id };
  });
}

export async function archiveExercise(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    const rows = unwrap(await supabase.from("exercises").update({ is_archived: true }).eq("id", id).eq("owner_id", userId).select("id"));
    if (!rows.length) throw new UserFacingError("Du kan bara ta bort egna övningar.");
    revalidateTraining();
    return null;
  });
}

// ---------------------------------------------------------------------------
// Sessions (every change is persisted immediately)
// ---------------------------------------------------------------------------

export async function startSession(raw: unknown) {
  return authedAction(async ({ supabase }) => {
    const input = z.object({ programDayId: uuid.nullable(), name: z.string().trim().max(120).optional(), date: z.string().optional() }).parse(raw);
    const id = unwrap(
      await supabase.rpc("start_workout_session", {
        p_program_day_id: input.programDayId ?? undefined,
        p_name: input.name ?? undefined,
        p_scheduled_for: input.date ?? undefined,
      }),
    );
    revalidateTraining();
    return { id };
  });
}

async function ownedOpenSession(auth: AuthContext, sessionId: string) {
  const s = unwrap(await auth.supabase.from("workout_sessions").select("id, status, paused_at, paused_seconds").eq("id", sessionId).eq("user_id", auth.userId).single());
  if (s.status !== "in_progress" && s.status !== "paused") throw new UserFacingError("Passet är redan avslutat.");
  return s;
}

export async function logSet(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = setLogSchema.parse(raw);
    validateSetInput({ weightKg: input.weightKg ?? null, reps: input.reps ?? null, rir: input.rir ?? null }, { requireComplete: input.isCompleted });
    const set = unwrap(
      await supabase.from("session_sets").select("id, session_id, workout_sessions(status)").eq("id", input.setId).eq("user_id", userId).single(),
    );
    const status = set.workout_sessions?.status;
    if (status !== "in_progress" && status !== "paused") throw new UserFacingError("Passet är redan avslutat.");
    unwrap(
      await supabase
        .from("session_sets")
        .update({
          weight_kg: input.weightKg ?? null,
          reps: input.reps ?? null,
          rir: input.rir ?? null,
          is_completed: input.isCompleted,
          completed_at: input.isCompleted ? new Date().toISOString() : null,
        })
        .eq("id", input.setId)
        .eq("user_id", userId),
    );
    return null;
  });
}

export async function addSet(rawSessionExerciseId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawSessionExerciseId);
    const se = unwrap(
      await auth.supabase.from("session_exercises").select("id, session_id, rep_max, session_sets(set_number, weight_kg, target_weight_kg)").eq("id", id).eq("user_id", auth.userId).single(),
    );
    await ownedOpenSession(auth, se.session_id);
    const sets = [...se.session_sets].sort((a, b) => a.set_number - b.set_number);
    const last = sets[sets.length - 1];
    const row = unwrap(
      await auth.supabase
        .from("session_sets")
        .insert({
          session_exercise_id: id,
          session_id: se.session_id,
          user_id: auth.userId,
          set_number: (last?.set_number ?? 0) + 1,
          target_reps: se.rep_max,
          target_weight_kg: last?.weight_kg ?? last?.target_weight_kg ?? null,
        })
        .select("*")
        .single(),
    );
    return row;
  });
}

export async function removeSet(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const set = unwrap(await auth.supabase.from("session_sets").select("session_id").eq("id", id).eq("user_id", auth.userId).single());
    await ownedOpenSession(auth, set.session_id);
    unwrap(await auth.supabase.from("session_sets").delete().eq("id", id).eq("user_id", auth.userId));
    return null;
  });
}

export async function addSessionExercise(raw: unknown) {
  return authedAction(async (auth) => {
    const input = z.object({ sessionId: uuid, exerciseId: uuid }).parse(raw);
    await ownedOpenSession(auth, input.sessionId);
    const { count } = await auth.supabase.from("session_exercises").select("id", { count: "exact", head: true }).eq("session_id", input.sessionId);
    const { data: prefs } = await auth.supabase.from("user_preferences").select("default_rest_seconds").eq("user_id", auth.userId).single();
    const se = unwrap(
      await auth.supabase
        .from("session_exercises")
        .insert({
          session_id: input.sessionId,
          user_id: auth.userId,
          exercise_id: input.exerciseId,
          position: count ?? 0,
          rep_min: 8,
          rep_max: 12,
          rest_seconds: prefs?.default_rest_seconds ?? 90,
        })
        .select("id")
        .single(),
    );
    unwrap(
      await auth.supabase.from("session_sets").insert(
        [1, 2, 3].map((n) => ({ session_exercise_id: se.id, session_id: input.sessionId, user_id: auth.userId, set_number: n, target_reps: 12 })),
      ),
    );
    revalidatePath(`/traning/pass/${input.sessionId}`);
    return null;
  });
}

export async function removeSessionExercise(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const se = unwrap(await auth.supabase.from("session_exercises").select("session_id").eq("id", id).eq("user_id", auth.userId).single());
    await ownedOpenSession(auth, se.session_id);
    unwrap(await auth.supabase.from("session_exercises").delete().eq("id", id).eq("user_id", auth.userId));
    revalidatePath(`/traning/pass/${se.session_id}`);
    return null;
  });
}

export async function updateSessionExerciseNotes(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = z.object({ id: uuid, notes: z.string().trim().max(1000) }).parse(raw);
    unwrap(await supabase.from("session_exercises").update({ notes: input.notes || null }).eq("id", input.id).eq("user_id", userId));
    return null;
  });
}

export async function updateSessionNotes(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = z.object({ id: uuid, notes: z.string().trim().max(4000) }).parse(raw);
    unwrap(await supabase.from("workout_sessions").update({ notes: input.notes || null }).eq("id", input.id).eq("user_id", userId));
    return null;
  });
}

export async function pauseSession(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const s = await ownedOpenSession(auth, id);
    if (s.status === "paused") return null;
    unwrap(await auth.supabase.from("workout_sessions").update({ status: "paused", paused_at: new Date().toISOString() }).eq("id", id).eq("user_id", auth.userId));
    return null;
  });
}

export async function resumeSession(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    const s = await ownedOpenSession(auth, id);
    if (s.status !== "paused" || !s.paused_at) return null;
    const pausedFor = Math.max(0, Math.round((Date.now() - new Date(s.paused_at).getTime()) / 1000));
    unwrap(
      await auth.supabase
        .from("workout_sessions")
        .update({ status: "in_progress", paused_at: null, paused_seconds: s.paused_seconds + pausedFor })
        .eq("id", id)
        .eq("user_id", auth.userId),
    );
    return null;
  });
}

export async function completeSession(raw: unknown) {
  return authedAction(async ({ supabase }) => {
    const input = z
      .object({ id: uuid, feedback: z.enum(["too_easy", "just_right", "too_hard"]).nullable().optional(), notes: z.string().trim().max(4000).optional() })
      .parse(raw);
    unwrap(await supabase.rpc("complete_workout_session", { p_session_id: input.id, p_feedback: input.feedback ?? undefined, p_notes: input.notes || undefined }));
    revalidateTraining();
    revalidatePath("/framsteg", "layout");
    return null;
  });
}

export async function abandonSession(rawId: unknown) {
  return authedAction(async (auth) => {
    const id = uuid.parse(rawId);
    await ownedOpenSession(auth, id);
    unwrap(await auth.supabase.from("workout_sessions").update({ status: "abandoned", paused_at: null }).eq("id", id).eq("user_id", auth.userId));
    revalidateTraining();
    return null;
  });
}

export async function searchExercises(raw: unknown) {
  return authedAction(async (auth) => {
    const input = z
      .object({ q: z.string().trim().max(80).optional(), muscle: z.string().max(40).optional(), equipment: z.string().max(40).optional() })
      .parse(raw ?? {});
    return listExercises(auth, { q: input.q || undefined, muscle: input.muscle || undefined, equipment: input.equipment || undefined });
  });
}

// ---------------------------------------------------------------------------
// AI workout generator (suggestions are never saved without explicit approval)
// ---------------------------------------------------------------------------

export async function generateWorkoutProgram(raw: unknown) {
  return authedAction(async (auth) => {
    const input = workoutGeneratorSchema.parse(raw);
    await consumeAiQuota(auth, "workout_plan");
    return generateWorkoutDraft(auth, input);
  });
}

/** Saves a reviewed AI program as a NEW, inactive program. Existing programs are untouched. */
export async function saveGeneratedProgram(raw: unknown) {
  return authedAction(async ({ supabase }) => {
    const input = saveWorkoutSchema.parse(raw);
    const id = unwrap(await supabase.rpc("create_workout_program", { p_program: toCreateProgramPayload(input) as unknown as Json }));
    revalidateTraining();
    return { id };
  });
}
