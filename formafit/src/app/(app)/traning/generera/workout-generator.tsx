"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BedDouble, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/choice";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/input";
import type { WorkoutDraft } from "@/lib/ai/workout-draft";
import { EXPERIENCE_LABELS, GOAL_LABELS, MUSCLE_LABELS, SPLIT_LABELS } from "@/lib/labels";
import { EQUIPMENT_OPTIONS, MUSCLE_OPTIONS } from "@/lib/options";
import { WEEKDAYS } from "@/lib/workout/logic";
import { generateWorkoutProgram, saveGeneratedProgram } from "../actions";

interface Defaults {
  experience: string;
  goal: string;
  daysPerWeek: number;
  equipment: string[];
}

export function WorkoutGenerator({ defaults, aiEnabled }: { defaults: Defaults; aiEnabled: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    experience: defaults.experience,
    goal: defaults.goal,
    daysPerWeek: String(defaults.daysPerWeek),
    sessionMinutes: "60",
    equipment: defaults.equipment,
    preferredExercises: "",
    avoidExercises: "",
    priorityMuscles: [] as string[],
  });
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);

  function updateExercise(dayIndex: number, exIndex: number, patch: Partial<WorkoutDraft["days"][number]["exercises"][number]>) {
    setDraft((d) =>
      d ? { ...d, days: d.days.map((day, i) => (i === dayIndex ? { ...day, exercises: day.exercises.map((e, j) => (j === exIndex ? { ...e, ...patch } : e)) } : day)) } : d,
    );
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const res = await saveGeneratedProgram({
      name: draft.name,
      splitType: draft.splitType,
      description: draft.description,
      progression: draft.progression,
      days: draft.days.map((d) => ({
        name: d.name,
        weekday: d.weekday,
        isRestDay: d.isRestDay || d.exercises.length === 0,
        notes: d.notes,
        exercises: d.exercises.map((e) => ({
          exerciseId: e.exercise.id,
          sets: e.sets,
          repMin: e.repMin,
          repMax: Math.max(e.repMin, e.repMax),
          restSeconds: e.restSeconds,
          tempo: e.tempo,
          supersetGroup: e.supersetGroup,
          notes: e.notes,
        })),
      })),
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Programmet är sparat – aktivera det när du vill");
    router.push(`/traning/program/${res.data.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-5">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await generateWorkoutProgram(form);
                if (!res.ok) return void toast.error(res.error);
                setDraft(res.data);
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Erfarenhet" htmlFor="wg-exp">
                <Select id="wg-exp" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })}>
                  {Object.entries(EXPERIENCE_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Mål" htmlFor="wg-goal">
                <Select id="wg-goal" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}>
                  {Object.entries(GOAL_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dagar per vecka" htmlFor="wg-days">
                <Select id="wg-days" value={form.daysPerWeek} onChange={(e) => setForm({ ...form, daysPerWeek: e.target.value })}>
                  {[1, 2, 3, 4, 5, 6].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Minuter per pass" htmlFor="wg-min">
                <Select id="wg-min" value={form.sessionMinutes} onChange={(e) => setForm({ ...form, sessionMinutes: e.target.value })}>
                  {[30, 45, 60, 75, 90].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Utrustning</span>
              <ChipGroup label="Utrustning" values={form.equipment} onChange={(v) => setForm({ ...form, equipment: v })} options={EQUIPMENT_OPTIONS} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Prioriterade muskelgrupper</span>
              <ChipGroup label="Prioriterade muskelgrupper" values={form.priorityMuscles} onChange={(v) => setForm({ ...form, priorityMuscles: v })} options={MUSCLE_OPTIONS} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Övningar du gillar" htmlFor="wg-pref" optional>
                <Input id="wg-pref" placeholder="T.ex. knäböj, chins" value={form.preferredExercises} onChange={(e) => setForm({ ...form, preferredExercises: e.target.value })} />
              </Field>
              <Field label="Övningar att undvika" htmlFor="wg-avoid" optional hint="Separera med kommatecken">
                <Input id="wg-avoid" placeholder="T.ex. marklyft" value={form.avoidExercises} onChange={(e) => setForm({ ...form, avoidExercises: e.target.value })} />
              </Field>
            </div>
            <Button type="submit" size="lg" className="self-start" loading={pending} disabled={!aiEnabled || !form.equipment.length}>
              <Sparkles /> {draft ? "Generera nytt förslag" : "Generera förslag"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {draft ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">
              <Sparkles /> AI-förslag – inte sparat
            </Badge>
            <span className="text-sm text-muted-foreground">{SPLIT_LABELS[draft.splitType]}</span>
          </div>
          <Field label="Programnamn" htmlFor="wg-name">
            <Input id="wg-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          {draft.description ? <p className="text-sm text-muted-foreground">{draft.description}</p> : null}
          {draft.progression ? <Notice title="Progressionsrekommendation">{draft.progression}</Notice> : null}
          {draft.discrepancies.length ? (
            <Notice variant="warning" title="Justeringar av förslaget">
              <ul className="list-disc pl-4">
                {draft.discrepancies.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
          <div className="flex flex-col gap-4">
            {draft.days.map((day, di) => (
              <Card key={di} className={day.isRestDay ? "bg-surface-muted/60" : undefined}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    {day.isRestDay ? <BedDouble className="size-4" aria-hidden /> : null}
                    {day.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{day.weekday ? WEEKDAYS[day.weekday - 1] : "Valfri dag"}{day.notes ? ` · ${day.notes}` : ""}</p>
                </CardHeader>
                {!day.isRestDay ? (
                  <CardContent>
                    <ul className="flex flex-col gap-2">
                      {day.exercises.map((e, ei) => (
                        <li key={ei} className="flex flex-wrap items-center gap-2 rounded-2xl border bg-surface p-2.5">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{e.exercise.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {e.exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m] ?? m).join(", ")}
                              {e.supersetGroup ? ` · superset ${e.supersetGroup}` : ""}
                              {e.notes ? ` · ${e.notes}` : ""}
                            </span>
                          </span>
                          <label className="flex items-center gap-1 text-xs">
                            Set
                            <Input className="h-9 w-14 text-center" inputMode="numeric" value={e.sets} onChange={(ev) => updateExercise(di, ei, { sets: Math.max(1, Math.min(20, Number(ev.target.value) || 1)) })} />
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            Reps
                            <Input className="h-9 w-14 text-center" inputMode="numeric" value={e.repMin} onChange={(ev) => updateExercise(di, ei, { repMin: Math.max(1, Math.min(100, Number(ev.target.value) || 1)) })} />
                            –
                            <Input className="h-9 w-14 text-center" inputMode="numeric" value={e.repMax} onChange={(ev) => updateExercise(di, ei, { repMax: Math.max(1, Math.min(100, Number(ev.target.value) || 1)) })} />
                          </label>
                          <span className="text-xs text-muted-foreground">vila {e.restSeconds} s</span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Ta bort ${e.exercise.name}`}
                            onClick={() => setDraft({ ...draft, days: draft.days.map((d, i) => (i === di ? { ...d, exercises: d.exercises.filter((_, j) => j !== ei) } : d)) })}
                          >
                            <Trash2 />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
          <Button size="lg" className="self-start" onClick={save} loading={saving}>
            <Save /> Spara som nytt program
          </Button>
          <p className="text-xs text-muted-foreground">Programmet sparas som inaktivt. Ditt nuvarande program ändras inte förrän du själv aktiverar det nya.</p>
        </>
      ) : null}
    </div>
  );
}
