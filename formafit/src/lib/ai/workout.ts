import "server-only";
import { UserFacingError } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth";
import { EQUIPMENT_LABELS, EXPERIENCE_LABELS, GOAL_LABELS, MUSCLE_LABELS } from "@/lib/labels";
import type { WorkoutGeneratorInput } from "@/lib/validation";
import { generateStructured } from "./client";
import { aiWorkoutSchema, buildExerciseRefs, exercisesForPrompt, resolveWorkout, type CandidateExercise, type WorkoutDraft } from "./workout-draft";

const SYSTEM = `Du är FormaFits träningsplanerare och skapar säkra, välbalanserade styrketräningsprogram på svenska för friska vuxna.
Regler:
- Använd ENBART övningar från kandidatlistan och referera med deras kod (t.ex. "E7"). Hitta aldrig på övningar.
- Anpassa volym och övningsval efter erfarenhet, mål, tid per pass och utrustning. Nybörjare: färre övningar, enklare rörelser, 2–3 set.
- Lägg flerledsövningar tidigt i passet. Undvik övningar användaren vill undvika.
- weekday 1=måndag … 7=söndag. Ta med vilodagar (is_rest_day=true) så att veckan blir komplett.
- superset_group: 0 om ingen superset, annars samma nummer för övningar som körs i följd.
- tempo: tom sträng eller format "3-1-1-0".
- progression: en kort, försiktig progressionsrekommendation (t.ex. dubbel progression). Inga osäkra råd.`;

export async function generateWorkoutDraft(auth: AuthContext, input: WorkoutGeneratorInput): Promise<WorkoutDraft> {
  const available = new Set([...input.equipment, "bodyweight"]);
  const { data, error } = await auth.supabase.from("exercises").select("id, name, primary_muscles, equipment").eq("is_archived", false).limit(400);
  if (error) throw error;
  const avoid = (input.avoidExercises ?? "")
    .split(",")
    .map((s) => s.trim().toLocaleLowerCase("sv-SE"))
    .filter(Boolean);
  const candidates: CandidateExercise[] = (data ?? [])
    .filter((e) => available.has(e.equipment))
    .filter((e) => !avoid.some((a) => e.name.toLocaleLowerCase("sv-SE").includes(a)))
    .map((e) => ({ id: e.id, name: e.name, primaryMuscles: e.primary_muscles, equipment: e.equipment }));
  if (candidates.length < 6) throw new UserFacingError("För få övningar matchar din utrustning. Välj mer utrustning eller skapa egna övningar.");
  const refs = buildExerciseRefs(candidates);
  const prompt = `Skapa ett veckoprogram.
Erfarenhet: ${EXPERIENCE_LABELS[input.experience]}
Mål: ${GOAL_LABELS[input.goal]}
Träningsdagar per vecka: ${input.daysPerWeek}
Tid per pass: cirka ${input.sessionMinutes} minuter
Utrustning: ${[...available].map((e) => EQUIPMENT_LABELS[e] ?? e).join(", ")}
Prioriterade muskelgrupper: ${input.priorityMuscles.map((m) => MUSCLE_LABELS[m] ?? m).join(", ") || "inga särskilda"}
Önskade övningar: ${input.preferredExercises || "inga särskilda"}
Övningar att undvika: ${input.avoidExercises || "inga"}

Kandidatövningar (kod | namn | primära muskler | utrustning):
${exercisesForPrompt(refs)}`;
  const output = await generateStructured({ schema: aiWorkoutSchema, system: SYSTEM, prompt, effort: "medium", maxTokens: 24000 });
  const draft = resolveWorkout(output, refs, input.daysPerWeek);
  if (!draft.days.some((d) => !d.isRestDay)) throw new UserFacingError("AI:n gav inget användbart program. Försök igen.");
  return draft;
}
