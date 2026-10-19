import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, CheckCircle2, Dumbbell, Sparkles, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { StartSessionButton } from "@/components/workout/start-session-button";
import { requireAuth } from "@/lib/auth";
import { getOpenSession, getWeekSchedule } from "@/lib/data/workouts";
import { formatDate, todayIso } from "@/lib/dates";
import { WEEKDAYS } from "@/lib/workout/logic";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Träning" };

export default async function TrainingPage() {
  const auth = await requireAuth();
  const today = todayIso();
  const [schedule, open] = await Promise.all([getWeekSchedule(auth, today), getOpenSession(auth)]);
  return (
    <>
      <PageHeader
        title="Träning"
        description={schedule.program ? `Aktivt program: ${schedule.program.name}` : "Välj ett program eller starta ett fritt pass."}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/traning/generera">
                <Sparkles /> AI-program
              </Link>
            </Button>
            {!open ? <StartSessionButton programDayId={null} label="Fritt pass" variant="outline" /> : null}
          </>
        }
      />

      {open ? (
        <Card className="mb-6 border-primary/40 bg-primary-soft/50">
          <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Timer className="size-6 text-primary-strong" aria-hidden />
              <div>
                <p className="font-semibold">{open.name}</p>
                <p className="text-sm text-muted-foreground">{open.status === "paused" ? "Pausat pass" : "Pågående pass"} – dina loggade set är sparade.</p>
              </div>
            </div>
            <Button asChild>
              <Link href={`/traning/pass/${open.id}`}>Fortsätt passet</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {schedule.program ? (
        <Card>
          <CardHeader>
            <CardTitle>Veckan</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {schedule.days.map((d) => {
                const isToday = d.date === today;
                return (
                  <li key={d.date} className={cn("flex flex-col gap-2 py-3 sm:flex-row sm:items-center", isToday && "rounded-2xl bg-surface-muted px-3")}>
                    <div className="w-36 shrink-0">
                      <p className="font-medium">{WEEKDAYS[d.weekday - 1]}</p>
                      <p className="text-xs text-muted-foreground">{isToday ? "Idag" : formatDate(d.date)}</p>
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      {d.planned.length === 0 && d.completed.length === 0 ? <span className="text-sm text-muted-foreground">Inget planerat</span> : null}
                      {d.planned.map((p) => (
                        <div key={p.id} className="flex flex-wrap items-center gap-2">
                          {p.isRest ? <BedDouble className="size-4 text-muted-foreground" aria-hidden /> : <Dumbbell className="size-4 text-primary-strong" aria-hidden />}
                          <span className="text-sm font-medium">{p.name}</span>
                          {!p.isRest ? <span className="text-xs text-muted-foreground">{p.exerciseCount} övningar</span> : <Badge>Vilodag</Badge>}
                          {p.completedSessionId ? (
                            <Badge variant="primary">
                              <CheckCircle2 /> Genomfört
                            </Badge>
                          ) : !p.isRest && !open && d.date >= today ? (
                            <StartSessionButton programDayId={p.id} date={d.date} size="sm" variant={isToday ? "default" : "outline"} className="ml-auto" label="Starta" />
                          ) : null}
                        </div>
                      ))}
                      {d.completed
                        .filter((c) => !d.planned.some((p) => p.completedSessionId === c.id))
                        .map((c) => (
                          <Link key={c.id} href={`/traning/pass/${c.id}`} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="size-4 text-primary" aria-hidden /> {c.name}
                          </Link>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Ett pass räknas som genomfört först när du avslutat ett loggat pass.</p>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Dumbbell}
          title="Inget aktivt program"
          description="Välj en färdig mall, bygg ett eget program eller låt AI föreslå ett upplägg."
          action={
            <Button asChild>
              <Link href="/traning/program">Välj program</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
