import type { Metadata } from "next";
import Link from "next/link";
import { ChartLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { ConsistencyChart, IntakeChart, MacroChart, StrengthProgress, WeightChart } from "@/components/charts/progress-charts";
import { WeeklySummaryCard } from "@/components/progress/weekly-summary-card";
import { requireAuth } from "@/lib/auth";
import { getProgressOverview, getStrengthSeries } from "@/lib/data/progress";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "Framsteg" };

export default async function ProgressPage() {
  const auth = await requireAuth();
  const today = todayIso();
  const [overview, strength] = await Promise.all([getProgressOverview(auth, today), getStrengthSeries(auth)]);
  const loggedDays = overview.intake.filter((d) => d.kcal > 0).length;
  const anyData = overview.weights.length > 0 || loggedDays > 0 || overview.consistency.some((w) => w.count > 0);
  return (
    <>
      <PageHeader title="Framsteg" description="Allt här bygger på dina egna loggar – inget fylls i eller gissas." />
      {!anyData ? (
        <EmptyState
          icon={ChartLine}
          title="Inte tillräckligt med historik ännu"
          description="Logga vikt, mat och träning i några dagar så visas trender och veckosammanfattningar här."
          action={
            <Button asChild>
              <Link href="/framsteg/matt">Logga vikt</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <WeeklySummaryCard summary={overview.thisWeek} title="Den här veckan" />
            <WeeklySummaryCard summary={overview.lastWeek} title="Förra veckan" />
          </div>
          {overview.weights.length >= 2 ? (
            <WeightChart weights={overview.weights} weekly={overview.weeklyWeights} />
          ) : (
            <EmptyState icon={ChartLine} title="Väg dig minst två gånger" description="Viktkurvan och veckosnittet visas när du har minst två vägningar." />
          )}
          {loggedDays ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <IntakeChart intake={overview.intake} target={overview.targets?.calories ?? null} />
              <MacroChart intake={overview.intake} />
            </div>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-2">
            <ConsistencyChart weeks={overview.consistency} scheduledPerWeek={overview.scheduledPerWeek} />
            {strength.length ? (
              <StrengthProgress series={strength} />
            ) : (
              <EmptyState icon={ChartLine} title="Ingen styrkehistorik ännu" description="Genomförda pass med loggade set visas som styrkekurvor här." />
            )}
          </div>
        </div>
      )}
    </>
  );
}
