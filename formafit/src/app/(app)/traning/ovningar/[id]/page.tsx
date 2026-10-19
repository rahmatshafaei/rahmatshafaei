import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { MediaThumb } from "@/components/shared/media-thumb";
import { StrengthChart } from "@/components/charts/strength-chart";
import { requireAuth } from "@/lib/auth";
import { getExerciseHistory, summarizeExercises } from "@/lib/data/workouts";
import { formatDate } from "@/lib/dates";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/labels";
import { uuid } from "@/lib/validation";
import { estimateOneRepMax, formatKg, personalRecords } from "@/lib/workout/logic";
import { ExerciseForm } from "../exercise-form";

export const metadata: Metadata = { title: "Övning" };

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (id === "ny") {
    return (
      <>
        <PageHeader title="Ny övning" description="Egna övningar syns bara för dig." />
        <Card>
          <CardContent className="pt-5">
            <ExerciseForm />
          </CardContent>
        </Card>
      </>
    );
  }
  if (!uuid.safeParse(id).success) notFound();
  const { data: row } = await auth.supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const [exercise] = await summarizeExercises(auth, [row]);
  const history = (await getExerciseHistory(auth, [id])).get(id) ?? [];
  const records = personalRecords(history);
  const bySession = new Map<string, { date: string; best: number; top: number }>();
  for (const s of history) {
    const cur = bySession.get(s.sessionId) ?? { date: s.date, best: 0, top: 0 };
    cur.best = Math.max(cur.best, estimateOneRepMax(s.weightKg, s.reps));
    cur.top = Math.max(cur.top, s.weightKg);
    bySession.set(s.sessionId, cur);
  }
  const chart = [...bySession.values()].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ date: p.date, e1rm: Math.round(p.best * 10) / 10, top: p.top }));

  return (
    <>
      <PageHeader title={exercise.name} description={`${exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m] ?? m).join(", ")} · ${EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment}`} />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="flex flex-col gap-4">
          <MediaThumb src={exercise.imageUrl} alt={exercise.imageUrl ? `Bild som visar ${exercise.name}` : ""} kind="exercise" size="lg" />
          {exercise.imageUrl ? (
            <p className="text-xs text-muted-foreground">Bild: {exercise.imageCredit}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Ingen demonstrationsbild finns ännu. Skapa en egen övning för att ladda upp en bild.</p>
          )}
          {exercise.videoUrl ? (
            <a href={exercise.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary-strong underline">
              <ExternalLink className="size-4" /> Visa video
            </a>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {exercise.secondaryMuscles.map((m) => (
              <Badge key={m} variant="outline">
                {MUSCLE_LABELS[m] ?? m}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {exercise.instructions.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Utförande</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                  {exercise.instructions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                {exercise.tips ? <p className="mt-3 text-sm text-muted-foreground">{exercise.tips}</p> : null}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Din utveckling</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length ? (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {records.heaviestWeight ? (
                      <div className="rounded-2xl bg-surface-muted p-3 text-sm">
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Trophy className="size-3.5" /> Tyngst
                        </p>
                        <p className="font-semibold tabular">
                          {formatKg(records.heaviestWeight.weightKg)} × {records.heaviestWeight.reps}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(records.heaviestWeight.date)}</p>
                      </div>
                    ) : null}
                    {records.bestEstimated1RM ? (
                      <div className="rounded-2xl bg-surface-muted p-3 text-sm">
                        <p className="text-xs text-muted-foreground">Uppskattat 1RM (Epley)</p>
                        <p className="font-semibold tabular">{formatKg(Math.round(records.bestEstimated1RM.value * 10) / 10)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(records.bestEstimated1RM.date)}</p>
                      </div>
                    ) : null}
                    {records.bestSessionVolume ? (
                      <div className="rounded-2xl bg-surface-muted p-3 text-sm">
                        <p className="text-xs text-muted-foreground">Mest volym i ett pass</p>
                        <p className="font-semibold tabular">{Math.round(records.bestSessionVolume.value).toLocaleString("sv-SE")} kg</p>
                        <p className="text-xs text-muted-foreground">{formatDate(records.bestSessionVolume.date)}</p>
                      </div>
                    ) : null}
                  </div>
                  {chart.length > 1 ? <StrengthChart data={chart} /> : <p className="text-sm text-muted-foreground">Logga övningen i fler pass för att se en kurva.</p>}
                </div>
              ) : (
                <EmptyState icon={Trophy} title="Ingen historik ännu" description="När du loggar övningen i ett genomfört pass visas rekord och utveckling här." />
              )}
            </CardContent>
          </Card>
          {exercise.isOwn ? (
            <Card>
              <CardHeader>
                <CardTitle>Redigera</CardTitle>
              </CardHeader>
              <CardContent>
                <ExerciseForm exercise={exercise} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
