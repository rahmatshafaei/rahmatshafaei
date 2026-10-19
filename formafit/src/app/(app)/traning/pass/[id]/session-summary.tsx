import Link from "next/link";
import { CheckCircle2, Clock, Dumbbell, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice, PageHeader } from "@/components/ui/feedback";
import type { SessionDetail } from "@/lib/data/workouts";
import { formatDateTime } from "@/lib/dates";
import { FEEDBACK_LABELS } from "@/lib/labels";
import { activeDurationSeconds, estimateOneRepMax, formatDuration, formatKg } from "@/lib/workout/logic";

export function SessionSummary({ detail }: { detail: SessionDetail }) {
  const { session, exercises } = detail;
  const completedSets = exercises.flatMap((e) => e.sets.filter((s) => s.is_completed && !s.is_warmup));
  const volume = completedSets.reduce((s, x) => s + Number(x.weight_kg) * (x.reps ?? 0), 0);
  return (
    <>
      <PageHeader
        title={session.name}
        eyebrow={
          <Link href="/traning/historik" className="hover:underline">
            Historik
          </Link>
        }
        description={formatDateTime(session.started_at)}
      />
      {session.status === "abandoned" ? <Notice variant="warning" className="mb-4">Passet avbröts och räknas inte som genomfört.</Notice> : null}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { icon: Clock, label: "Tid", value: formatDuration(activeDurationSeconds(session)) },
          { icon: CheckCircle2, label: "Set", value: String(completedSets.length) },
          { icon: Dumbbell, label: "Volym", value: `${Math.round(volume).toLocaleString("sv-SE")} kg` },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} className="p-4">
            <Icon className="size-5 text-primary-strong" aria-hidden />
            <p className="mt-2 text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold tabular">{value}</p>
          </Card>
        ))}
      </div>
      {session.feedback ? <p className="mb-4 text-sm text-muted-foreground">Upplevelse: {FEEDBACK_LABELS[session.feedback]}</p> : null}
      {session.notes ? <p className="mb-4 text-sm">{session.notes}</p> : null}
      <div className="flex flex-col gap-3">
        {exercises.map((e) => {
          const done = e.sets.filter((s) => s.is_completed);
          const best = done.reduce((m, s) => Math.max(m, estimateOneRepMax(Number(s.weight_kg), s.reps ?? 0)), 0);
          const pr = e.records.bestEstimated1RM ? best > e.records.bestEstimated1RM.value + 1e-9 : false;
          return (
            <Card key={e.id}>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle>
                  <Link href={`/traning/ovningar/${e.exercise_id}`} className="hover:underline">
                    {e.exercise.name}
                  </Link>
                </CardTitle>
                {pr ? (
                  <Badge variant="warning">
                    <Trophy /> Personbästa
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent>
                {done.length ? (
                  <p className="text-sm tabular text-muted-foreground">{done.map((s) => `${formatKg(Number(s.weight_kg))} × ${s.reps}`).join(" · ")}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Inga genomförda set.</p>
                )}
                {e.notes ? <p className="mt-1 text-sm">{e.notes}</p> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
