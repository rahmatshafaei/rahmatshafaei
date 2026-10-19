"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/choice";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { ExerciseSummary } from "@/lib/data/workouts";
import { EQUIPMENT_LABELS } from "@/lib/labels";
import { MUSCLE_OPTIONS } from "@/lib/options";
import { archiveExercise, createExercise, updateExercise } from "../actions";

export function ExerciseForm({ exercise }: { exercise?: ExerciseSummary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [s, setS] = useState({
    name: exercise?.name ?? "",
    primaryMuscles: exercise?.primaryMuscles ?? [],
    secondaryMuscles: exercise?.secondaryMuscles ?? [],
    equipment: exercise?.equipment ?? "dumbbell",
    mechanics: exercise?.mechanics ?? "compound",
    instructions: exercise?.instructions.length ? exercise.instructions : [""],
    tips: exercise?.tips ?? "",
    videoUrl: exercise?.videoUrl ?? "",
  });
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("data", JSON.stringify({ ...s, instructions: s.instructions.map((x) => x.trim()).filter(Boolean) }));
        if (image) fd.set("image", image);
        start(async () => {
          const res = exercise ? await updateExercise(exercise.id, fd) : await createExercise(fd);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            return void toast.error(res.error);
          }
          toast.success("Övningen är sparad");
          router.push(`/traning/ovningar/${res.data.id}`);
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Namn" htmlFor="ex-name" error={errors.name} className="sm:col-span-3">
          <Input id="ex-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
        </Field>
        <Field label="Utrustning" htmlFor="ex-eq">
          <Select id="ex-eq" value={s.equipment} onChange={(e) => setS({ ...s, equipment: e.target.value })}>
            {Object.entries(EQUIPMENT_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Typ" htmlFor="ex-mech">
          <Select id="ex-mech" value={s.mechanics} onChange={(e) => setS({ ...s, mechanics: e.target.value })}>
            <option value="compound">Flerledsövning</option>
            <option value="isolation">Isolering</option>
          </Select>
        </Field>
        <Field label="Videolänk" htmlFor="ex-video" optional error={errors.videoUrl}>
          <Input id="ex-video" type="url" placeholder="https://" value={s.videoUrl} onChange={(e) => setS({ ...s, videoUrl: e.target.value })} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Primära muskler</span>
        <ChipGroup label="Primära muskler" values={s.primaryMuscles} onChange={(v) => setS({ ...s, primaryMuscles: v })} options={MUSCLE_OPTIONS} />
        {errors.primaryMuscles ? <p className="text-sm text-danger">{errors.primaryMuscles[0]}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Sekundära muskler</span>
        <ChipGroup label="Sekundära muskler" values={s.secondaryMuscles} onChange={(v) => setS({ ...s, secondaryMuscles: v })} options={MUSCLE_OPTIONS} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Instruktioner</span>
        {s.instructions.map((step, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-2.5 w-5 text-sm text-muted-foreground">{i + 1}.</span>
            <Input aria-label={`Steg ${i + 1}`} value={step} onChange={(e) => setS({ ...s, instructions: s.instructions.map((x, j) => (j === i ? e.target.value : x)) })} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Ta bort steg ${i + 1}`} onClick={() => setS({ ...s, instructions: s.instructions.filter((_, j) => j !== i) })}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setS({ ...s, instructions: [...s.instructions, ""] })}>
          <Plus /> Steg
        </Button>
      </div>
      <Field label="Tips" htmlFor="ex-tips" optional>
        <Textarea id="ex-tips" rows={2} value={s.tips} onChange={(e) => setS({ ...s, tips: e.target.value })} />
      </Field>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground hover:border-primary/40">
        <ImagePlus className="size-5" aria-hidden />
        {image ? image.name : "Ladda upp en egen bild som visar övningen (JPEG, PNG eller WebP, max 5 MB)"}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          {exercise ? "Spara ändringar" : "Skapa övning"}
        </Button>
        {exercise ? (
          <Button
            type="button"
            variant="ghost"
            className="text-danger"
            onClick={() =>
              start(async () => {
                const res = await archiveExercise(exercise.id);
                if (!res.ok) return void toast.error(res.error);
                router.push("/traning/ovningar");
              })
            }
          >
            <Trash2 /> Ta bort
          </Button>
        ) : null}
      </div>
    </form>
  );
}
