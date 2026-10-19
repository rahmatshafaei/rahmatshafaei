import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Dumbbell, Plus, Sparkles, Timer, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DaySummary } from "@/components/nutrition/day-summary";
import { WeeklySummaryCard } from "@/components/progress/weekly-summary-card";
import { StartSessionButton } from "@/components/workout/start-session-button";
import { requireAuth } from "@/lib/auth";
import { getDiaryDay, getPlannedMealsForDate } from "@/lib/data/diary";
import { getProfile, getTargets } from "@/lib/data/profile";
import { getProgressOverview } from "@/lib/data/progress";
import { getOpenSession, getWeekSchedule } from "@/lib/data/workouts";
import { formatLongDate, todayIso } from "@/lib/dates";
import { NoticeToast, QuickWeight } from "./home-client";

export const metadata: Metadata = { title: "Hem" };

const COACH_PROMPTS = ["Hur ligger jag till mot mitt proteinmål den här veckan?", "Föreslå ett snabbt mellanmål med mycket protein", "Hur ska jag tänka kring progression i bänkpress?"];

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("sv-SE", { hour: "numeric", timeZone: "Europe/Stockholm" }).format(new Date()));
  if (hour < 10) return "God morgon";
  if (hour < 17) return "Hej";
  return "God kväll";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ losenord?: string }> }) {
  const params = await searchParams;
  const auth = await requireAuth();
  const today = todayIso();
  const [profile, targets, day, schedule, open, planned, overview] = await Promise.all([
    getProfile(auth),
    getTargets(auth),
    getDiaryDay(auth, today),
    getWeekSchedule(auth, today),
    getOpenSession(auth),
    getPlannedMealsForDate(auth, today),
    getProgressOverview(auth, today),
  ]);
  const todayPlan = schedule.days.find((d) => d.date === today);
  const latestWeight = overview.weights[overview.weights.length - 1] ?? null;
  const weekly = overview.weeklyWeights;
  const weeklyChange = weekly.length >= 2 ? weekly[weekly.length - 1].average - weekly[weekly.length - 2].average : null;
  const plannedLeft = planned.filter((m) => !m.consumptionId);

  return (
    <>
      {params.losenord ? <NoticeToast message="Ditt lösenord är uppdaterat." /> : null}
      <div className="mb-6">
        <p className="text-sm text-muted-foreground capitalize">{formatLongDate(today)}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting()}, {profile?.display_name ?? "där"}!
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle>Dagens mat</CardTitle>
              <Button size="sm" asChild>
                <Link href="/mat">
                  <Plus /> Logga mat
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <DaySummary totals={day.totals.total} targets={targets} />
              {plannedLeft.length ? (
                <Link href="/mat" className="mt-4 flex items-center gap-2 rounded-2xl bg-surface-muted p-3 text-sm">
                  <UtensilsCrossed className="size-4 text-primary-strong" aria-hidden />
                  <span className="flex-1">
                    {plannedLeft.length} planerad{plannedLeft.length === 1 ? "" : "e"} måltid{plannedLeft.length === 1 ? "" : "er"} kvar idag
                  </span>
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 bg-[#13261b] text-white">
            <CardContent className="relative pt-5">
              <div aria-hidden className="absolute -top-16 -right-10 size-48 rounded-full bg-[radial-gradient(circle,rgba(24,160,88,0.5),transparent_65%)]" />
              <div className="relative flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
                  <Bot className="size-6 text-[#7ee2a8]" aria-hidden />
                </div>
                <div>
                  <p className="font-semibold">Din AI-coach</p>
                  <p className="text-sm text-white/70">Fråga om kost, träning eller dina egna loggar.</p>
                </div>
              </div>
              <div className="relative mt-4 flex flex-col gap-2">
                {COACH_PROMPTS.map((q) => (
                  <Link key={q} href={`/coach?fraga=${encodeURIComponent(q)}`} className="rounded-2xl bg-white/10 px-3 py-2.5 text-sm transition-colors hover:bg-white/15">
                    {q}
                  </Link>
                ))}
              </div>
              <Button asChild className="relative mt-4 bg-white text-[#13261b] hover:bg-white/90">
                <Link href="/coach">
                  <Sparkles /> Öppna coachen
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Dumbbell className="size-4 text-primary-strong" aria-hidden /> Dagens träning
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {open ? (
                <div className="flex items-center gap-3">
                  <Timer className="size-5 text-primary-strong" aria-hidden />
                  <span className="flex-1 text-sm">{open.name} pågår</span>
                  <Button size="sm" asChild>
                    <Link href={`/traning/pass/${open.id}`}>Fortsätt</Link>
                  </Button>
                </div>
              ) : null}
              {!schedule.program ? (
                <p className="text-sm text-muted-foreground">
                  Inget aktivt program.{" "}
                  <Link href="/traning/program" className="text-primary-strong underline">
                    Välj ett program
                  </Link>
                </p>
              ) : todayPlan && todayPlan.planned.length ? (
                todayPlan.planned.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="flex-1">
                      <span className="block font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.isRest ? "Vilodag – återhämtning är också träning" : `${p.exerciseCount} övningar`}</span>
                    </span>
                    {p.completedSessionId ? (
                      <span className="flex items-center gap-1 text-sm text-primary-strong">
                        <CheckCircle2 className="size-4" /> Klart
                      </span>
                    ) : !p.isRest && !open ? (
                      <StartSessionButton programDayId={p.id} date={today} size="sm" label="Starta" />
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Inget schemalagt idag.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Vikt</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {latestWeight ? (
                <p className="text-sm">
                  <span className="text-2xl font-semibold tabular">{latestWeight.weightKg.toLocaleString("sv-SE")} kg</span>
                  <span className="ml-2 text-muted-foreground">senast {latestWeight.date === today ? "idag" : latestWeight.date}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Ingen vägning loggad ännu.</p>
              )}
              {weeklyChange !== null ? (
                <p className="text-xs text-muted-foreground">
                  Veckosnitt {weeklyChange > 0 ? "+" : ""}
                  {weeklyChange.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} kg jämfört med förra veckan
                </p>
              ) : null}
              <QuickWeight today={today} />
            </CardContent>
          </Card>

          <WeeklySummaryCard summary={overview.thisWeek} title="Veckan hittills" />
        </div>
      </div>
    </>
  );
}
