"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { searchExercises } from "@/app/(app)/traning/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { MediaThumb } from "@/components/shared/media-thumb";
import type { ExerciseSummary } from "@/lib/data/workouts";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/labels";

export function ExerciseFilters({
  q,
  muscle,
  equipment,
  onChange,
}: {
  q: string;
  muscle: string;
  equipment: string;
  onChange: (v: { q: string; muscle: string; equipment: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" placeholder="Sök övning…" aria-label="Sök övning" value={q} onChange={(e) => onChange({ q: e.target.value, muscle, equipment })} className="pl-10" autoFocus />
      </div>
      <Select aria-label="Muskelgrupp" value={muscle} onChange={(e) => onChange({ q, muscle: e.target.value, equipment })} className="sm:w-44">
        <option value="">Alla muskler</option>
        {Object.entries(MUSCLE_LABELS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </Select>
      <Select aria-label="Utrustning" value={equipment} onChange={(e) => onChange({ q, muscle, equipment: e.target.value })} className="sm:w-44">
        <option value="">All utrustning</option>
        {Object.entries(EQUIPMENT_LABELS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function ExercisePicker({ open, onOpenChange, onPick, title = "Lägg till övning" }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (e: ExerciseSummary) => Promise<void> | void; title?: string }) {
  const [filters, setFilters] = useState({ q: "", muscle: "", equipment: "" });
  const [results, setResults] = useState<ExerciseSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const req = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++req.current;
    const t = setTimeout(async () => {
      const res = await searchExercises(filters);
      if (id !== req.current) return;
      if (!res.ok) return void toast.error(res.error);
      setResults(res.data);
    }, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [filters, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} wide className="sm:min-h-[32rem]">
        <div className="flex flex-col gap-3">
          <ExerciseFilters {...filters} onChange={setFilters} />
          {results === null ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : results.length ? (
            <ul className="flex flex-col gap-2">
              {results.map((e) => (
                <li key={e.id}>
                  <button
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy(e.id);
                      await onPick(e);
                      setBusy(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border bg-surface p-2.5 text-left hover:border-primary/40"
                  >
                    <MediaThumb src={e.imageUrl} alt="" kind="exercise" size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {e.primaryMuscles.map((m) => MUSCLE_LABELS[m] ?? m).join(", ")} · {EQUIPMENT_LABELS[e.equipment] ?? e.equipment}
                      </span>
                    </span>
                    {e.isOwn ? <Badge variant="info">Egen</Badge> : null}
                    {busy === e.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4 text-muted-foreground" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Inga övningar matchar filtren.</p>
          )}
          <Button variant="outline" asChild>
            <Link href="/traning/ovningar/ny">
              <Plus /> Skapa egen övning
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
