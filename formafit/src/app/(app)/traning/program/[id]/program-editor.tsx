"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useSyncedState } from "@/lib/hooks";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, BedDouble, Copy, EllipsisVertical, GripVertical, Link2, Pencil, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Notice, PageHeader } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea, UnitInput } from "@/components/ui/input";
import { MediaThumb } from "@/components/shared/media-thumb";
import { ExercisePicker } from "@/components/workout/exercise-picker";
import { StartSessionButton } from "@/components/workout/start-session-button";
import type { ProgramDetail } from "@/lib/data/workouts";
import { MUSCLE_LABELS, SPLIT_LABELS } from "@/lib/labels";
import { WEEKDAYS } from "@/lib/workout/logic";
import { cn } from "@/lib/utils";
import {
  addDay,
  addProgramExercise,
  deactivateProgram,
  deleteDay,
  deleteProgram,
  duplicateProgram,
  duplicateProgramExercise,
  moveDay,
  removeProgramExercise,
  reorderProgramExercises,
  setActiveProgram,
  updateDay,
  updateProgram,
  updateProgramExercise,
} from "../../actions";

type Day = ProgramDetail["days"][number];
type ProgramExercise = Day["exercises"][number];

export function ProgramEditor({ detail, hasOpenSession }: { detail: ProgramDetail; hasOpenSession: boolean }) {
  const router = useRouter();
  const { program } = detail;
  const [days, setDays] = useSyncedState(detail.days);
  const [, start] = useTransition();
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<Day | null>(null);
  const [editingExercise, setEditingExercise] = useState<ProgramExercise | null>(null);
  const [confirm, setConfirm] = useState<null | "activate" | "delete" | { deleteDay: Day }>(null);
  const [editProgram, setEditProgram] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const refresh = () => router.refresh();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (success) toast.success(success);
      refresh();
    });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function onDragEnd(day: Day, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = day.exercises.map((e) => e.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setDays((ds) => ds.map((d) => (d.id === day.id ? { ...d, exercises: next.map((id) => d.exercises.find((e) => e.id === id)!) } : d)));
    start(async () => {
      const res = await reorderProgramExercises({ dayId: day.id, orderedIds: next });
      if (!res.ok) {
        toast.error(res.error);
        refresh();
      }
    });
  }

  return (
    <>
      <PageHeader
        title={program.name}
        eyebrow={
          <Link href="/traning/program" className="hover:underline">
            Program
          </Link>
        }
        description={`${SPLIT_LABELS[program.split_type]}${program.description ? ` · ${program.description}` : ""}`}
        actions={
          <>
            {program.source === "ai" ? (
              <Badge variant="info" className="self-center">
                <Sparkles /> Från AI-förslag
              </Badge>
            ) : null}
            {program.is_active ? (
              <Button variant="outline" onClick={() => run(() => deactivateProgram(program.id), "Programmet är inte längre aktivt")}>
                <Star className="fill-current" /> Aktivt
              </Button>
            ) : (
              <Button onClick={() => setConfirm("activate")}>
                <Star /> Gör aktivt
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Fler val för programmet">
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setEditProgram(true)}>
                  <Pencil /> Redigera program
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDuplicating(true)}>
                  <Copy /> Kopiera programmet
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setConfirm("delete")}>
                  <Trash2 /> Ta bort program
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {days.map((day, index) => (
          <Card key={day.id} className={cn(day.is_rest_day && "bg-surface-muted/60")}>
            <div className="flex items-center gap-2 p-4 pb-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {day.is_rest_day ? <BedDouble className="size-4 text-muted-foreground" aria-hidden /> : null}
                  <h2 className="truncate font-semibold">{day.name}</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  {day.weekday ? WEEKDAYS[day.weekday - 1] : "Ingen fast veckodag"}
                  {day.is_rest_day ? " · Vilodag" : ` · ${day.exercises.length} övningar`}
                </p>
              </div>
              {!day.is_rest_day && day.exercises.length && !hasOpenSession ? <StartSessionButton programDayId={day.id} size="sm" label="Starta" /> : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Val för ${day.name}`}>
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => setEditingDay(day)}>
                    <Pencil /> Redigera dag
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={index === 0} onSelect={() => run(() => moveDay(day.id, "up"))}>
                    <ArrowUp /> Flytta upp
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={index === days.length - 1} onSelect={() => run(() => moveDay(day.id, "down"))}>
                    <ArrowDown /> Flytta ned
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setConfirm({ deleteDay: day })}>
                    <Trash2 /> Ta bort dag
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardContent className="flex flex-col gap-2 pt-2">
              {day.notes ? <p className="text-sm text-muted-foreground">{day.notes}</p> : null}
              {day.exercises.length ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(day, e)}>
                  <SortableContext items={day.exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    <ul className="flex flex-col gap-2">
                      {day.exercises.map((pe, i) => {
                        const prev = day.exercises[i - 1];
                        const next = day.exercises[i + 1];
                        const inSuperset = pe.superset_group !== null && (prev?.superset_group === pe.superset_group || next?.superset_group === pe.superset_group);
                        return (
                          <SortableExercise
                            key={pe.id}
                            pe={pe}
                            inSuperset={inSuperset}
                            onEdit={() => setEditingExercise(pe)}
                            onDuplicate={() => run(() => duplicateProgramExercise(pe.id))}
                            onRemove={() => run(() => removeProgramExercise(pe.id))}
                            onSuperset={() => {
                              if (!next) return;
                              const group = pe.superset_group ?? Math.max(0, ...day.exercises.map((e) => e.superset_group ?? 0)) + 1;
                              run(async () => {
                                const a = await updateProgramExercise(toForm(pe, { supersetGroup: group }));
                                if (!a.ok) return a;
                                return updateProgramExercise(toForm(next, { supersetGroup: group }));
                              }, "Superset skapat");
                            }}
                            canSuperset={Boolean(next)}
                          />
                        );
                      })}
                    </ul>
                  </SortableContext>
                </DndContext>
              ) : !day.is_rest_day ? (
                <p className="text-sm text-muted-foreground">Inga övningar ännu.</p>
              ) : null}
              <Button variant="soft" size="sm" className="self-start" onClick={() => setPickerDay(day.id)}>
                <Plus /> Övning
              </Button>
            </CardContent>
          </Card>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => run(() => addDay({ programId: program.id, rest: false }))}>
            <Plus /> Träningsdag
          </Button>
          <Button variant="outline" onClick={() => run(() => addDay({ programId: program.id, rest: true }))}>
            <BedDouble /> Vilodag
          </Button>
        </div>
      </div>

      <ExercisePicker
        open={pickerDay !== null}
        onOpenChange={(o) => !o && setPickerDay(null)}
        onPick={async (ex) => {
          const res = await addProgramExercise({ dayId: pickerDay, exerciseId: ex.id });
          if (!res.ok) return void toast.error(res.error);
          toast.success(`${ex.name} tillagd`);
          refresh();
        }}
      />
      {editingDay ? <DayDialog day={editingDay} onClose={() => setEditingDay(null)} onSaved={refresh} /> : null}
      {editingExercise ? <ExerciseDialog pe={editingExercise} onClose={() => setEditingExercise(null)} onSaved={refresh} /> : null}
      {editProgram ? <ProgramDialog program={program} onClose={() => setEditProgram(false)} onSaved={refresh} /> : null}
      {duplicating ? <DuplicateDialog program={program} onClose={() => setDuplicating(false)} /> : null}

      <ConfirmDialog
        open={confirm === "activate"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Gör programmet aktivt?"
        description="Det aktiva programmet styr veckoschemat. Ett tidigare aktivt program blir inaktivt men tas inte bort."
        confirmLabel="Gör aktivt"
        onConfirm={async () => {
          const res = await setActiveProgram(program.id);
          if (!res.ok) return void toast.error(res.error);
          refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title="Ta bort programmet?"
        description="Programmet tas bort. Genomförda pass och loggade set finns kvar i historiken."
        confirmLabel="Ta bort"
        onConfirm={async () => {
          const res = await deleteProgram(program.id);
          if (!res.ok) return void toast.error(res.error);
          router.push("/traning/program");
        }}
      />
      <ConfirmDialog
        open={typeof confirm === "object" && confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title="Ta bort dagen?"
        description="Dagen och dess övningar tas bort från programmet. Historiken påverkas inte."
        confirmLabel="Ta bort"
        onConfirm={async () => {
          if (typeof confirm !== "object" || !confirm) return;
          const res = await deleteDay(confirm.deleteDay.id);
          if (!res.ok) return void toast.error(res.error);
          refresh();
        }}
      />
    </>
  );
}

function toForm(pe: ProgramExercise, override: Partial<{ supersetGroup: number | null }> = {}) {
  return {
    id: pe.id,
    sets: pe.sets,
    repMin: pe.rep_min,
    repMax: pe.rep_max,
    suggestedWeightKg: pe.suggested_weight_kg,
    restSeconds: pe.rest_seconds,
    tempo: pe.tempo,
    supersetGroup: "supersetGroup" in override ? override.supersetGroup : pe.superset_group,
    notes: pe.notes,
  };
}

function SortableExercise({
  pe,
  inSuperset,
  onEdit,
  onDuplicate,
  onRemove,
  onSuperset,
  canSuperset,
}: {
  pe: ProgramExercise;
  inSuperset: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSuperset: () => void;
  canSuperset: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: pe.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 rounded-2xl border bg-surface p-2", inSuperset && "border-l-4 border-l-macro-fat")}
    >
      <button ref={setActivatorNodeRef} {...attributes} {...listeners} className="cursor-grab touch-none rounded-lg p-1 text-muted-foreground" aria-label={`Flytta ${pe.exercise.name}`}>
        <GripVertical className="size-4" />
      </button>
      <MediaThumb src={pe.exercise.imageUrl} alt="" kind="exercise" size="sm" />
      <button className="min-w-0 flex-1 text-left" onClick={onEdit}>
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium">{pe.exercise.name}</span>
          {inSuperset ? <Badge className="bg-[#efe7fb] text-macro-fat">Superset {pe.superset_group}</Badge> : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground tabular">
          {pe.sets} × {pe.rep_min === pe.rep_max ? pe.rep_min : `${pe.rep_min}–${pe.rep_max}`}
          {pe.suggested_weight_kg !== null ? ` · ${Number(pe.suggested_weight_kg).toLocaleString("sv-SE")} kg` : ""} · vila {pe.rest_seconds} s
          {pe.tempo ? ` · tempo ${pe.tempo}` : ""} · {pe.exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m] ?? m).join(", ")}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Val för ${pe.exercise.name}`}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> Ändra set och reps
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy /> Duplicera
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSuperset} disabled={!canSuperset}>
            <Link2 /> Superset med nästa
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/traning/ovningar/${pe.exercise_id}`}>Visa övning</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onRemove}>
            <Trash2 /> Ta bort
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function ExerciseDialog({ pe, onClose, onSaved }: { pe: ProgramExercise; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState({
    sets: String(pe.sets),
    repMin: String(pe.rep_min),
    repMax: String(pe.rep_max),
    suggestedWeightKg: pe.suggested_weight_kg?.toString() ?? "",
    restSeconds: String(pe.rest_seconds),
    tempo: pe.tempo ?? "",
    supersetGroup: pe.superset_group?.toString() ?? "",
    notes: pe.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={pe.exercise.name}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await updateProgramExercise({ id: pe.id, ...s });
              if (!res.ok) {
                setErrors(res.fieldErrors ?? {});
                return void toast.error(res.error);
              }
              onClose();
              onSaved();
            });
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <Field label="Set" htmlFor="pe-sets" error={errors.sets}>
              <UnitInput unit="st" id="pe-sets" value={s.sets} onChange={(e) => setS({ ...s, sets: e.target.value })} />
            </Field>
            <Field label="Reps min" htmlFor="pe-min" error={errors.repMin}>
              <Input id="pe-min" inputMode="numeric" value={s.repMin} onChange={(e) => setS({ ...s, repMin: e.target.value })} />
            </Field>
            <Field label="Reps max" htmlFor="pe-max" error={errors.repMax}>
              <Input id="pe-max" inputMode="numeric" value={s.repMax} onChange={(e) => setS({ ...s, repMax: e.target.value })} />
            </Field>
            <Field label="Föreslagen vikt" htmlFor="pe-w" optional error={errors.suggestedWeightKg}>
              <UnitInput unit="kg" id="pe-w" value={s.suggestedWeightKg} onChange={(e) => setS({ ...s, suggestedWeightKg: e.target.value })} />
            </Field>
            <Field label="Vila" htmlFor="pe-rest" error={errors.restSeconds}>
              <UnitInput unit="sek" id="pe-rest" value={s.restSeconds} onChange={(e) => setS({ ...s, restSeconds: e.target.value })} />
            </Field>
            <Field label="Tempo" htmlFor="pe-tempo" optional error={errors.tempo}>
              <Input id="pe-tempo" placeholder="3-1-1-0" value={s.tempo} onChange={(e) => setS({ ...s, tempo: e.target.value })} />
            </Field>
          </div>
          <Field label="Supersetgrupp" htmlFor="pe-ss" optional hint="Övningar med samma nummer körs i följd utan vila.">
            <Input id="pe-ss" inputMode="numeric" value={s.supersetGroup} onChange={(e) => setS({ ...s, supersetGroup: e.target.value })} />
          </Field>
          <Field label="Egna anteckningar" htmlFor="pe-notes" optional>
            <Textarea id="pe-notes" rows={2} value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" loading={pending}>
              Spara
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DayDialog({ day, onClose, onSaved }: { day: Day; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState({ name: day.name, weekday: String(day.weekday ?? 0), isRestDay: day.is_rest_day, notes: day.notes ?? "" });
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Redigera dag">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await updateDay({ id: day.id, ...s });
              if (!res.ok) return void toast.error(res.error);
              onClose();
              onSaved();
            });
          }}
        >
          <Field label="Namn" htmlFor="d-name">
            <Input id="d-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <Field label="Veckodag" htmlFor="d-wd">
            <Select id="d-wd" value={s.weekday} onChange={(e) => setS({ ...s, weekday: e.target.value })}>
              <option value="0">Ingen fast dag</option>
              {WEEKDAYS.map((w, i) => (
                <option key={w} value={i + 1}>
                  {w}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={s.isRestDay} onChange={(e) => setS({ ...s, isRestDay: e.target.checked })} />
            Vilodag
          </label>
          {s.isRestDay && day.exercises.length ? <Notice variant="warning">Dagens övningar behålls men dagen visas som vila.</Notice> : null}
          <Field label="Anteckningar" htmlFor="d-notes" optional>
            <Textarea id="d-notes" rows={2} value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} />
          </Field>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              Spara
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProgramDialog({ program, onClose, onSaved }: { program: ProgramDetail["program"]; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState({ name: program.name, splitType: program.split_type, description: program.description ?? "" });
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Redigera program">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await updateProgram({ id: program.id, ...s });
              if (!res.ok) return void toast.error(res.error);
              onClose();
              onSaved();
            });
          }}
        >
          <Field label="Namn" htmlFor="p-name">
            <Input id="p-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <Field label="Upplägg" htmlFor="p-split">
            <Select id="p-split" value={s.splitType} onChange={(e) => setS({ ...s, splitType: e.target.value as typeof s.splitType })}>
              {Object.entries(SPLIT_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Beskrivning" htmlFor="p-desc" optional>
            <Textarea id="p-desc" value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} />
          </Field>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              Spara
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateDialog({ program, onClose }: { program: ProgramDetail["program"]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(`${program.name} (kopia)`);
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Kopiera programmet" description="Kopian blir ett nytt, inaktivt program.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await duplicateProgram({ id: program.id, name });
              if (!res.ok) return void toast.error(res.error);
              router.push(`/traning/program/${res.data.id}`);
            });
          }}
        >
          <Field label="Namn" htmlFor="dup-name">
            <Input id="dup-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              Kopiera
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
