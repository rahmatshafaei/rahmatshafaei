"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Camera, Columns2, ImagePlus, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { deleteProgressPhoto, uploadProgressPhoto } from "../actions";

interface Photo {
  id: string;
  takenOn: string;
  pose: string;
  notes: string | null;
  url: string | null;
}

const POSES: Record<string, string> = { front: "Framifrån", side: "Från sidan", back: "Bakifrån", other: "Övrigt" };

export function PhotoGallery({ photos, today }: { photos: Photo[]; today: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ takenOn: today, pose: "front", notes: "" });
  const [pending, start] = useTransition();
  const [compare, setCompare] = useState<{ a: string; b: string }>({ a: photos[photos.length - 1]?.id ?? "", b: photos[0]?.id ?? "" });
  const [deleting, setDeleting] = useState<Photo | null>(null);
  const a = photos.find((p) => p.id === compare.a);
  const b = photos.find((p) => p.id === compare.b);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4" aria-hidden /> Ladda upp bild
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!file) return void toast.error("Välj en bild.");
              const fd = new FormData();
              fd.set("photo", file);
              fd.set("takenOn", meta.takenOn);
              fd.set("pose", meta.pose);
              if (meta.notes) fd.set("notes", meta.notes);
              start(async () => {
                const res = await uploadProgressPhoto(fd);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Bilden är sparad privat");
                setFile(null);
                router.refresh();
              });
            }}
          >
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 text-sm text-muted-foreground hover:border-primary/40">
              <ImagePlus className="size-4" aria-hidden />
              <span className="truncate">{file ? file.name : "Välj bild (max 8 MB)"}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Field label="Datum" htmlFor="ph-date">
              <Input id="ph-date" type="date" max={today} value={meta.takenOn} onChange={(e) => setMeta({ ...meta, takenOn: e.target.value })} />
            </Field>
            <Field label="Vinkel" htmlFor="ph-pose">
              <Select id="ph-pose" value={meta.pose} onChange={(e) => setMeta({ ...meta, pose: e.target.value })}>
                {Object.entries(POSES).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" loading={pending}>
              <Camera /> Spara
            </Button>
          </form>
        </CardContent>
      </Card>

      {photos.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Columns2 className="size-4" aria-hidden /> Jämför
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {(["a", "b"] as const).map((side) => {
                const p = side === "a" ? a : b;
                return (
                  <div key={side} className="flex flex-col gap-2">
                    <Select aria-label={side === "a" ? "Första bilden" : "Andra bilden"} value={compare[side]} onChange={(e) => setCompare({ ...compare, [side]: e.target.value })}>
                      {photos.map((x) => (
                        <option key={x.id} value={x.id}>
                          {formatDate(x.takenOn, { day: "numeric", month: "short", year: "numeric" })} – {POSES[x.pose]}
                        </option>
                      ))}
                    </Select>
                    {p?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private signed URL
                      <img src={p.url} alt={`Framstegsbild ${p.takenOn}`} className="aspect-[3/4] w-full rounded-2xl bg-surface-muted object-cover" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {photos.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.id} className="group relative overflow-hidden rounded-2xl border bg-surface">
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- private signed URL
                <img src={p.url} alt={`Framstegsbild ${p.takenOn}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
              ) : (
                <div className="aspect-[3/4] w-full bg-surface-muted" />
              )}
              <figcaption className="flex items-center justify-between gap-2 p-2 text-xs">
                <span>
                  {formatDate(p.takenOn, { day: "numeric", month: "short", year: "numeric" })} · {POSES[p.pose]}
                </span>
                <Button variant="ghost" size="icon-sm" aria-label={`Ta bort bilden från ${p.takenOn}`} onClick={() => setDeleting(p)}>
                  <Trash2 />
                </Button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <EmptyState icon={Camera} title="Inga bilder ännu" description="Ta bilder i samma ljus och vinkel var 2–4 vecka för att lättare se förändringar." />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title="Ta bort bilden?"
        description="Bilden raderas permanent från din privata lagring."
        confirmLabel="Ta bort"
        onConfirm={async () => {
          if (!deleting) return;
          const res = await deleteProgressPhoto(deleting.id);
          if (!res.ok) return void toast.error(res.error);
          router.refresh();
        }}
      />
    </div>
  );
}
