import { describe, expect, it } from "vitest";
import { buildExerciseRefs, exercisesForPrompt, resolveWorkout, toCreateProgramPayload, type AiWorkout } from "./workout-draft";

const bench = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Bänkpress", primaryMuscles: ["chest"], equipment: "barbell" };
const row = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Hantelrodd", primaryMuscles: ["lats"], equipment: "dumbbell" };
const refs = buildExerciseRefs([bench, row]);

const ex = (ref: string, sets = 3, repMin = 8, repMax = 12) => ({ ref, sets, rep_min: repMin, rep_max: repMax, rest_seconds: 90, tempo: "", superset_group: 0, notes: "" });

const output = (days: AiWorkout["days"]): AiWorkout => ({ name: "Test", split_type: "full_body", description: "", progression: "Öka 2,5 kg när alla set når 12 reps.", days });

describe("workout draft", () => {
  it("does not expose database ids", () => {
    expect(exercisesForPrompt(refs)).not.toContain(bench.id);
  });

  it("maps refs to library exercises and drops unknown ones", () => {
    const d = resolveWorkout(output([{ name: "A", weekday: 1, is_rest_day: false, notes: "", exercises: [ex("E1"), ex("E9"), ex("e2")] }]), refs, 3);
    expect(d.days[0].exercises.map((e) => e.exercise.id)).toEqual([bench.id, row.id]);
    expect(d.discrepancies.some((x) => x.includes("E9"))).toBe(true);
  });

  it("clamps unsafe volumes and fixes inverted rep ranges", () => {
    const d = resolveWorkout(output([{ name: "A", weekday: 1, is_rest_day: false, notes: "", exercises: [{ ...ex("E1", 20, 12, 6), rest_seconds: 5 }] }]), refs, 3);
    const e = d.days[0].exercises[0];
    expect(e.sets).toBe(8);
    expect(e.repMax).toBeGreaterThanOrEqual(e.repMin);
    expect(e.restSeconds).toBe(30);
  });

  it("enforces the requested number of training days and unique weekdays", () => {
    const d = resolveWorkout(
      output([
        { name: "A", weekday: 1, is_rest_day: false, notes: "", exercises: [ex("E1")] },
        { name: "B", weekday: 1, is_rest_day: false, notes: "", exercises: [ex("E2")] },
        { name: "C", weekday: 3, is_rest_day: false, notes: "", exercises: [ex("E1")] },
        { name: "Vila", weekday: 2, is_rest_day: true, notes: "", exercises: [] },
      ]),
      refs,
      2,
    );
    expect(d.days.filter((x) => !x.isRestDay)).toHaveLength(2);
    expect(d.days[1].weekday).toBeNull();
    expect(d.days.some((x) => x.isRestDay)).toBe(true);
  });

  it("builds a create_workout_program payload marked as AI", () => {
    const payload = toCreateProgramPayload({
      name: "P",
      splitType: "full_body",
      description: "Beskrivning",
      progression: "Dubbel progression",
      days: [{ name: "A", weekday: 1, isRestDay: false, notes: "", exercises: [{ exerciseId: bench.id, sets: 3, repMin: 8, repMax: 10, restSeconds: 120, tempo: null, supersetGroup: null, notes: "" }] }],
    });
    expect(payload.source).toBe("ai");
    expect(payload.days[0].exercises[0]).toMatchObject({ exercise_id: bench.id, rep_min: 8, rep_max: 10 });
  });
});
