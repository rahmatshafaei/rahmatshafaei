"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Check, CloudOff, Flag, History, Lightbulb, MessageSquare, Minus, Pause, Play, Plus, SkipForward, Timer, Trash2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/input";
import { ExercisePicker } from "@/components/workout/exercise-picker";
import type { SessionDetail } from "@/lib/data/workouts";
import { formatDate } from "@/lib/dates";
import { MUSCLE_LABELS } from "@/lib/labels";
import { activeDurationSeconds, estimateOneRepMax, formatDuration, formatKg } from "@/lib/workout/logic";
import {
  applyPending,
  enqueuePending,
  FLUSH_SETS_EVENT,
  isInFlight,
  parsePending,
  PENDING_SETS_EVENT,
  PENDING_SETS_PREFIX,
  readPending,
  removePending,
  setInFlight,
  type PendingSet,
} from "@/lib/workout/offline-queue";
import { useLocalStorage, useNow, useOnline, useSyncedState } from "@/lib/hooks";
import { callAction } from "@/lib/offline";
import { cn } from "@/lib/utils";
import {
  abandonSession,
  addSessionExercise,
  addSet,
  completeSession,
  logSet,
  pauseSession,
  removeSessionExercise,
  removeSet,
  resumeSession,
  updateSessionExerciseNotes,
  updateSessionNotes,
} from "../../actions";

type Exercise = SessionDetail["exercises"][number];
type SetRow = Exercise["sets"][number];

const parseNum = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const formatInput = (v: number | null) => v?.toString().replace(".", ",") ?? "";
const toPendingEntry = (input: Omit<PendingSet, "queuedAt">): PendingSet => ({ ...input, queuedAt: Date.now() });

/** Set logs queued on this device for the session (see offline-queue.ts). */
function usePendingSets(sessionId: string): PendingSet[] {
  const raw = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(PENDING_SETS_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(PENDING_SETS_EVENT, onChange);
      };
    },
    () => {
      try {
        return localStorage.getItem(PENDING_SETS_PREFIX + sessionId);
      } catch {
        return null;
      }
    },
    () => null,
  );
  return useMemo(() => parsePending(raw), [raw]);
}

/**
 * Sends queued set logs whenever the device is online, oldest first. `onSynced` is called for
 * every entry the server accepted (so the screen keeps showing it), `onFinished` after a run
 * that changed something.
 */
function useSyncPendingSets(
  sessionId: string,
  hasPending: boolean,
  onSynced: (entry: PendingSet) => void,
  onFinished: (result: { sent: number; rejected: number }) => void,
) {
  const online = useOnline();
  const syncing = useRef(false);
  const synced = useEffectEvent(onSynced);
  const finished = useEffectEvent(onFinished);
  useEffect(() => {
    if (!online || !hasPending) return;
    async function flush() {
      if (syncing.current) return;
      syncing.current = true;
      let sent = 0;
      let rejected = 0;
      try {
        // Values entered while a sync runs are queued too, so repeat until the queue is empty.
        for (let round = 0; round < 5; round++) {
          const items = readPending(sessionId)
            .filter((p) => !isInFlight(sessionId, p))
            .sort((a, b) => a.queuedAt - b.queuedAt);
          if (items.length === 0) break;
          for (const p of items) {
            let res;
            try {
              res = await logSet({ setId: p.setId, weightKg: p.weightKg, reps: p.reps, rir: p.rir, isCompleted: p.isCompleted, completedAt: p.completedAt });
            } catch {
              return; // Still unreachable: keep the queue and retry later.
            }
            if (!res.ok && res.code === "unauthorized") {
              toast.error("Du har loggats ut. Logga in igen för att skicka seten som sparats på enheten.", { id: "offline-sets" });
              return; // Keep everything until the user has signed in again.
            }
            if (!res.ok && res.code === "retryable") return; // Temporary server problem: retry later.
            // The server has decided, so retrying cannot help.
            if (res.ok) {
              synced(p);
              sent++;
            } else {
              rejected++;
              toast.error(`Ett set som sparats på enheten kunde inte sparas: ${res.error}`);
            }
            removePending(sessionId, p.setId, p.queuedAt);
          }
        }
      } finally {
        syncing.current = false;
        if (sent > 0 || rejected > 0) finished({ sent, rejected });
      }
    }
    const run = () => void flush();
    run();
    const timer = setInterval(run, 15_000);
    window.addEventListener(FLUSH_SETS_EVENT, run);
    return () => {
      clearInterval(timer);
      window.removeEventListener(FLUSH_SETS_EVENT, run);
    };
  }, [online, hasPending, sessionId]);
  return online;
}

/** Rest timer state survives reloads via localStorage (a per-device convenience only). */
function useRestTimer(sessionId: string) {
  const [stored, setStored] = useLocalStorage(`formafit:rest:${sessionId}`);
  const now = useNow(500);
  const endsAt = stored ? Number(stored) : null;
  const remaining = endsAt && now ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  const notified = useRef<number | null>(null);
  useEffect(() => {
    if (endsAt && now && remaining === 0 && notified.current !== endsAt) {
      notified.current = endsAt;
      navigator.vibrate?.([200, 100, 200]);
      toast("Vilan är slut – dags för nästa set!");
      setStored(null);
    }
  }, [remaining, endsAt, now, setStored]);
  return {
    remaining,
    active: endsAt !== null && now !== null && remaining > 0,
    start: (s: number) => setStored(String(Date.now() + s * 1000)),
    add: (s: number) => endsAt && setStored(String(endsAt + s * 1000)),
    stop: () => setStored(null),
  };
}

export function ActiveWorkout({ detail }: { detail: SessionDetail }) {
  const router = useRouter();
  const { session } = detail;
  const [exercises, setExercises] = useSyncedState(detail.exercises);
  const [status, setStatus] = useState(session.status);
  const [pausedAt, setPausedAt] = useState(session.paused_at);
  const [pausedSeconds, setPausedSeconds] = useState(session.paused_seconds);
  // null until hydrated, so server and client render the same markup.
  const now = useNow(1000);
  const [picker, setPicker] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [, start] = useTransition();
  const rest = useRestTimer(session.id);
  const pending = usePendingSets(session.id);
  const shown = useMemo(() => applyPending(exercises, pending), [exercises, pending]);

  const elapsed = now ? activeDurationSeconds({ started_at: session.started_at, paused_at: pausedAt, paused_seconds: pausedSeconds, status }, new Date(now)) : null;
  const completedCount = shown.reduce((s, e) => s + e.sets.filter((x) => x.is_completed).length, 0);
  const totalSets = shown.reduce((s, e) => s + e.sets.length, 0);

  function patchSet(exerciseId: string, setId: string, patch: Partial<SetRow>) {
    setExercises((xs) => xs.map((e) => (e.id === exerciseId ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : e)));
  }

  function patchSetById(setId: string, patch: Partial<SetRow>) {
    setExercises((xs) => xs.map((e) => (e.sets.some((s) => s.id === setId) ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : e)));
  }

  // Re-render when a save stops being in flight (that changes no stored value).
  const [, setFlightVersion] = useState(0);
  const online = useSyncPendingSets(
    session.id,
    pending.length > 0,
    (p) => patchSetById(p.setId, { weight_kg: p.weightKg, reps: p.reps, rir: p.rir, is_completed: p.isCompleted }),
    ({ sent, rejected }) => {
      if (sent > 0 && rejected === 0 && readPending(session.id).length === 0) toast.success("Alla set är sparade.", { id: "offline-sets" });
      router.refresh();
    },
  );
  // Saves that are on their way right now are not "waiting".
  const waiting = pending.filter((p) => !isInFlight(session.id, p)).length;

  async function persistSet(ex: Exercise, set: SetRow, values: { weightKg: number | null; reps: number | null; isCompleted: boolean }) {
    const previous = { weight_kg: set.weight_kg, reps: set.reps, is_completed: set.is_completed };
    patchSet(ex.id, set.id, { weight_kg: values.weightKg, reps: values.reps, is_completed: values.isCompleted });
    const input = {
      setId: set.id,
      weightKg: values.weightKg,
      reps: values.reps,
      rir: set.rir,
      isCompleted: values.isCompleted,
      completedAt: values.isCompleted ? new Date().toISOString() : null,
    };
    const entry = toPendingEntry(input);
    // Older queued values for this set must reach the server first.
    const behindQueue = readPending(session.id).some((p) => p.setId === set.id);
    // Write ahead: the values survive on the device even if the app is closed mid-request.
    setInFlight(session.id, entry, true);
    const stored = enqueuePending(session.id, entry);
    const done = () => setInFlight(session.id, entry, false);

    const keepOnDevice = (message: string | null) => {
      done();
      setFlightVersion((v) => v + 1);
      if (!stored) {
        removePending(session.id, set.id, entry.queuedAt);
        patchSet(ex.id, set.id, previous);
        toast.error("Setet kunde inte sparas – varken på servern eller på enheten.");
        return false;
      }
      if (message) toast(message, { id: "offline-sets" });
      if (navigator.onLine) window.dispatchEvent(new Event(FLUSH_SETS_EVENT));
      return true;
    };

    const offline = "Ingen uppkoppling – setet sparas på enheten och skickas automatiskt.";
    if (!navigator.onLine) return keepOnDevice(offline);
    if (behindQueue) return keepOnDevice(null);
    let res;
    try {
      res = await logSet(input);
    } catch {
      return keepOnDevice(offline);
    }
    if (res.ok) {
      done();
      removePending(session.id, set.id, entry.queuedAt);
      return true;
    }
    if (res.code === "unauthorized") return keepOnDevice("Du har loggats ut – setet sparas på enheten tills du loggar in igen.");
    if (res.code === "retryable") return keepOnDevice("Servern svarar inte just nu – setet sparas på enheten och skickas igen.");
    done();
    removePending(session.id, set.id, entry.queuedAt);
    patchSet(ex.id, set.id, previous);
    toast.error(res.error);
    return false;
  }

  async function togglePause() {
    if (status === "paused") {
      const res = await callAction(() => resumeSession(session.id));
      if (!res.ok) return void toast.error(res.error);
      if (pausedAt) setPausedSeconds((p) => p + Math.round((Date.now() - new Date(pausedAt).getTime()) / 1000));
      setPausedAt(null);
      setStatus("in_progress");
    } else {
      const res = await callAction(() => pauseSession(session.id));
      if (!res.ok) return void toast.error(res.error);
      setPausedAt(new Date().toISOString());
      setStatus("paused");
      rest.stop();
    }
  }

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">{session.name}</h1>
            <p className="text-sm text-muted-foreground tabular">
              {elapsed === null ? "–" : formatDuration(elapsed)} · {completedCount}/{totalSets} set
              {status === "paused" ? " · Pausat" : ""}
            </p>
            {!online || waiting > 0 ? (
              <p role="status" className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warning-ink">
                <CloudOff className="size-3.5 shrink-0" aria-hidden />
                {!online
                  ? waiting > 0
                    ? `Offline – ${waiting} set sparade på enheten`
                    : "Offline – set sparas på enheten"
                  : `${waiting} set sparade på enheten – skickas…`}
              </p>
            ) : null}
          </div>
          <Button variant="outline" size="icon" onClick={togglePause} aria-label={status === "paused" ? "Fortsätt passet" : "Pausa passet"}>
            {status === "paused" ? <Play /> : <Pause />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setNotesOpen(true)} aria-label="Anteckningar för passet">
            <MessageSquare />
          </Button>
          <Button onClick={() => setFinishOpen(true)}>
            <Flag /> Avsluta
          </Button>
        </div>
      </div>

      {status === "paused" ? (
        <Notice className="mb-4" title="Passet är pausat">
          Tiden står still. Allt du loggat är sparat – du kan lämna sidan och fortsätta senare.
        </Notice>
      ) : null}

      <div className="flex flex-col gap-4">
        {shown.map((ex) => (
          <ExerciseCard
            key={ex.id}
            ex={ex}
            onPersist={(set, values) => persistSet(ex, set, values)}
            onCompleted={(set, weight, reps) => {
              if (ex.rest_seconds > 0) rest.start(ex.rest_seconds);
              const e1rm = estimateOneRepMax(weight, reps);
              if (ex.records.bestEstimated1RM && e1rm > ex.records.bestEstimated1RM.value + 1e-9) {
                toast.success(`Nytt personbästa i ${ex.exercise.name}!`, { icon: <Trophy className="size-4" /> });
              }
              void set;
            }}
            onAddSet={() =>
              start(async () => {
                const res = await callAction(() => addSet(ex.id));
                if (!res.ok) return void toast.error(res.error);
                setExercises((xs) => xs.map((e) => (e.id === ex.id ? { ...e, sets: [...e.sets, res.data] } : e)));
              })
            }
            onRemoveSet={(setId) =>
              start(async () => {
                const res = await callAction(() => removeSet(setId));
                if (!res.ok) return void toast.error(res.error);
                setExercises((xs) => xs.map((e) => (e.id === ex.id ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e)));
              })
            }
            onRemoveExercise={() =>
              start(async () => {
                const res = await callAction(() => removeSessionExercise(ex.id));
                if (!res.ok) return void toast.error(res.error);
                router.refresh();
              })
            }
          />
        ))}
        <Button variant="outline" onClick={() => setPicker(true)}>
          <Plus /> Lägg till övning
        </Button>
        <Button variant="ghost" className="text-danger" onClick={() => setAbandonOpen(true)}>
          <X /> Avbryt passet
        </Button>
      </div>

      {rest.active ? (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-4 lg:bottom-6 lg:left-64">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-full border border-white/10 bg-brand-ink py-2 pr-2 pl-4 text-white shadow-[var(--shadow-float)]" role="timer" aria-live="polite">
            <Timer className="size-5 text-brand-ink-accent" aria-hidden />
            <span className="flex-1 text-lg font-semibold tabular">{formatDuration(rest.remaining)}</span>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => rest.add(-15)} aria-label="15 sekunder kortare vila">
              <Minus /> 15
            </Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => rest.add(15)} aria-label="15 sekunder längre vila">
              <Plus /> 15
            </Button>
            <Button size="sm" className="rounded-full" onClick={rest.stop}>
              <SkipForward /> Hoppa
            </Button>
          </div>
        </div>
      ) : null}

      <ExercisePicker
        open={picker}
        onOpenChange={setPicker}
        onPick={async (e) => {
          const res = await callAction(() => addSessionExercise({ sessionId: session.id, exerciseId: e.id }));
          if (!res.ok) return void toast.error(res.error);
          setPicker(false);
          router.refresh();
        }}
      />
      <FinishDialog
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        onFinished={rest.stop}
        sessionId={session.id}
        completedCount={completedCount}
        totalSets={totalSets}
        pendingCount={pending.length}
        initialNotes={session.notes ?? ""}
      />
      <SessionNotesDialog open={notesOpen} onClose={() => setNotesOpen(false)} sessionId={session.id} initial={session.notes ?? ""} />
      <ConfirmDialog
        open={abandonOpen}
        onOpenChange={setAbandonOpen}
        destructive
        title="Avbryta passet?"
        description="Passet markeras som avbrutet och räknas inte som genomfört. Loggade set sparas inte i din styrkehistorik."
        confirmLabel="Avbryt passet"
        onConfirm={async () => {
          const res = await callAction(() => abandonSession(session.id));
          if (!res.ok) return void toast.error(res.error);
          rest.stop();
          router.push("/traning");
        }}
      />
    </div>
  );
}

function ExerciseCard({
  ex,
  onPersist,
  onCompleted,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
}: {
  ex: Exercise;
  onPersist: (set: SetRow, values: { weightKg: number | null; reps: number | null; isCompleted: boolean }) => Promise<boolean>;
  onCompleted: (set: SetRow, weight: number, reps: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemoveExercise: () => void;
}) {
  const [notes, setNotes] = useState(ex.notes ?? "");
  const [showNotes, setShowNotes] = useState(Boolean(ex.notes));
  const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.is_completed);
  const previousBySet = ex.previous?.sets ?? [];
  return (
    <Card className={cn(allDone && "border-primary/40")}>
      <div className="flex items-start gap-3 p-4 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/traning/ovningar/${ex.exercise_id}`} className="font-semibold hover:underline">
              {ex.exercise.name}
            </Link>
            {ex.superset_group ? <Badge className="bg-superset-soft text-macro-fat">Superset {ex.superset_group}</Badge> : null}
            {allDone ? (
              <Badge variant="primary">
                <Check /> Klar
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {ex.exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m] ?? m).join(", ")}
            {ex.rep_min ? ` · mål ${ex.rep_min === ex.rep_max ? ex.rep_min : `${ex.rep_min}–${ex.rep_max}`} reps` : ""} · vila {ex.rest_seconds} s
            {ex.tempo ? ` · tempo ${ex.tempo}` : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setShowNotes((s) => !s)} aria-label="Anteckning för övningen">
          <MessageSquare />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onRemoveExercise} aria-label={`Ta bort ${ex.exercise.name} från passet`}>
          <Trash2 />
        </Button>
      </div>
      <CardContent className="flex flex-col gap-3">
        {ex.previous ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <History className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Förra gången ({formatDate(ex.previous.date)}): {ex.previous.sets.map((s) => `${formatKg(s.weightKg)} × ${s.reps}`).join(", ")}
            </span>
          </p>
        ) : null}
        {ex.suggestion.action !== "no_data" ? (
          <p className="flex items-start gap-1.5 rounded-xl bg-primary-soft/60 px-3 py-2 text-xs text-primary-strong">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-medium">Förslag:</span> {ex.suggestion.message}
            </span>
          </p>
        ) : null}

        <div className="grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>Set</span>
          <span>kg</span>
          <span>Reps</span>
          <span className="sr-only">Klar</span>
        </div>
        {ex.sets.map((set, i) => (
          <SetRowInput
            key={set.id}
            set={set}
            index={i}
            placeholderWeight={
              ex.sets.slice(0, i).reduce<number | null>((w, s) => (s.weight_kg !== null ? Number(s.weight_kg) : w), null) ??
              set.target_weight_kg ??
              previousBySet[i]?.weightKg ??
              ex.suggestion.suggestedWeightKg ??
              null
            }
            placeholderReps={set.target_reps ?? previousBySet[i]?.reps ?? null}
            onPersist={(values) => onPersist(set, values)}
            onCompleted={(w, r) => onCompleted(set, w, r)}
          />
        ))}
        <div className="flex gap-2">
          <Button variant="soft" size="sm" onClick={onAddSet}>
            <Plus /> Set
          </Button>
          {ex.sets.length ? (
            <Button variant="ghost" size="sm" onClick={() => onRemoveSet(ex.sets[ex.sets.length - 1].id)} disabled={ex.sets[ex.sets.length - 1].is_completed}>
              <Minus /> Ta bort sista
            </Button>
          ) : null}
        </div>
        {showNotes ? (
          <Textarea
            rows={2}
            placeholder="Anteckning, t.ex. känsla, teknik eller inställning på maskinen"
            aria-label={`Anteckning för ${ex.exercise.name}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={async () => {
              if (notes === (ex.notes ?? "")) return;
              const res = await callAction(() => updateSessionExerciseNotes({ id: ex.id, notes }));
              if (!res.ok) toast.error(res.error);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function SetRowInput({
  set,
  index,
  placeholderWeight,
  placeholderReps,
  onPersist,
  onCompleted,
}: {
  set: SetRow;
  index: number;
  placeholderWeight: number | null;
  placeholderReps: number | null;
  onPersist: (values: { weightKg: number | null; reps: number | null; isCompleted: boolean }) => Promise<boolean>;
  onCompleted: (weight: number, reps: number) => void;
}) {
  // Follow the set's values when they change from outside (queued values, a refresh).
  const [weight, setWeight] = useSyncedState(formatInput(set.weight_kg));
  const [reps, setReps] = useSyncedState(set.reps?.toString() ?? "");
  // Saves for one set run strictly in order (e.g. a blur save followed by the ✓ click).
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const save = (isCompleted: boolean, w = parseNum(weight), r = parseNum(reps)): Promise<boolean> => {
    if (w !== null && (!Number.isFinite(w) || w < 0 || w > 1000)) {
      toast.error("Ange en vikt mellan 0 och 1000 kg.");
      return Promise.resolve(false);
    }
    if (r !== null && (!Number.isInteger(r) || r < 0 || r > 200)) {
      toast.error("Ange reps som ett heltal.");
      return Promise.resolve(false);
    }
    const next = queue.current.then(() => onPersist({ weightKg: w, reps: r, isCompleted }));
    queue.current = next.catch(() => false);
    return next;
  };

  return (
    <div className={cn("grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2", set.is_completed && "opacity-90")}>
      <span className={cn("flex size-7 items-center justify-center rounded-lg text-sm font-semibold", set.is_completed ? "bg-primary-strong text-primary-foreground" : "bg-surface-muted")}>{index + 1}</span>
      <input
        inputMode="decimal"
        aria-label={`Vikt set ${index + 1}`}
        className="h-11 w-full rounded-xl border bg-surface px-3 text-center tabular focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
        placeholder={placeholderWeight !== null ? String(placeholderWeight).replace(".", ",") : "kg"}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={() => {
          const w = parseNum(weight);
          if (w !== (set.weight_kg === null ? null : Number(set.weight_kg))) void save(set.is_completed && w !== null);
        }}
      />
      <input
        inputMode="numeric"
        aria-label={`Repetitioner set ${index + 1}`}
        className="h-11 w-full rounded-xl border bg-surface px-3 text-center tabular focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
        placeholder={placeholderReps !== null ? String(placeholderReps) : "reps"}
        value={reps}
        onChange={(e) => setReps(e.target.value.replace(/\D/g, ""))}
        onBlur={() => {
          const r = parseNum(reps);
          if (r !== set.reps) void save(set.is_completed && r !== null);
        }}
      />
      <Button
        size="icon"
        variant={set.is_completed ? "default" : "outline"}
        aria-pressed={set.is_completed}
        aria-label={set.is_completed ? `Ångra set ${index + 1}` : `Markera set ${index + 1} som klart`}
        onClick={async () => {
          if (set.is_completed) {
            await save(false);
            return;
          }
          // Use the suggested values when the fields were left empty.
          const w = parseNum(weight) ?? placeholderWeight;
          const r = parseNum(reps) ?? placeholderReps;
          if (w === null || r === null) return void toast.error("Ange vikt och reps först.");
          setWeight(String(w).replace(".", ","));
          setReps(String(r));
          const ok = await save(true, w, r);
          if (ok) onCompleted(w, r);
        }}
      >
        <Check />
      </Button>
    </div>
  );
}

function FinishDialog({
  open,
  onClose,
  sessionId,
  completedCount,
  totalSets,
  pendingCount,
  initialNotes,
  onFinished,
}: {
  open: boolean;
  onClose: () => void;
  onFinished: () => void;
  sessionId: string;
  completedCount: number;
  totalSets: number;
  pendingCount: number;
  initialNotes: string;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<"too_easy" | "just_right" | "too_hard" | null>(null);
  const [notes, setNotes] = useState(initialNotes);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Avsluta passet">
        {completedCount === 0 ? (
          <Notice variant="warning">Du har inte markerat något set som klart. Ett pass kan bara avslutas när minst ett set är loggat.</Notice>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {completedCount} av {totalSets} set genomförda.
              {completedCount < totalSets ? " Ej markerade set sparas inte som genomförda." : ""}
            </p>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Hur kändes passet?</span>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["too_easy", "För lätt"],
                  ["just_right", "Lagom"],
                  ["too_hard", "För tungt"],
                ] as const).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={feedback === k}
                    onClick={() => setFeedback(k)}
                    className={cn("rounded-2xl border px-3 py-3 text-sm", feedback === k ? "border-primary bg-primary-soft text-primary-strong" : "bg-surface")}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Används för att göra progressionsförslagen försiktigare.</p>
            </div>
            {pendingCount > 0 ? (
              <Notice variant="warning" title={`${pendingCount} set är inte skickade än`}>
                De ligger sparade på enheten och skickas automatiskt när du är online. Sedan kan du spara passet.
              </Notice>
            ) : null}
            <Field label="Anteckningar" htmlFor="finish-notes" optional>
              <Textarea id="finish-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fortsätt träna
          </Button>
          <Button
            disabled={completedCount === 0 || pendingCount > 0}
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await callAction(() => completeSession({ id: sessionId, feedback, notes }));
                if (!res.ok) return void toast.error(res.error);
                onFinished();
                toast.success("Snyggt jobbat! Passet är sparat.");
                router.refresh();
              })
            }
          >
            <Flag /> Spara pass
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionNotesDialog({ open, onClose, sessionId, initial }: { open: boolean; onClose: () => void; sessionId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Anteckningar för passet">
        <Textarea rows={5} aria-label="Anteckningar" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <DialogFooter>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await callAction(() => updateSessionNotes({ id: sessionId, notes }));
                if (!res.ok) return void toast.error(res.error);
                onClose();
              })
            }
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
