import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { DaySummary } from "@/components/nutrition/day-summary";
import { requireAuth } from "@/lib/auth";
import { getDiaryDay, getPlannedMealsForDate } from "@/lib/data/diary";
import { getPreferences, getProfile, getTargets } from "@/lib/data/profile";
import { isIsoDate, todayIso } from "@/lib/dates";
import { DateNav, DiaryMeals, PlannedToday, WaterTracker } from "./diary-client";

export const metadata: Metadata = { title: "Matdagbok" };

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ datum?: string }> }) {
  const { datum } = await searchParams;
  const date = isIsoDate(datum) ? datum : todayIso();
  const auth = await requireAuth();
  const [day, targets, prefs, profile, planned] = await Promise.all([
    getDiaryDay(auth, date),
    getTargets(auth),
    getPreferences(auth),
    getProfile(auth),
    getPlannedMealsForDate(auth, date),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <DateNav date={date} today={todayIso()} />
      <Card>
        <CardContent className="pt-5">
          <DaySummary totals={day.totals.total} targets={targets} />
        </CardContent>
      </Card>
      {planned.length ? <PlannedToday date={date} meals={planned} /> : null}
      <DiaryMeals
        date={date}
        entries={day.entries}
        slotTotals={day.totals.bySlot}
        allergies={profile?.allergies ?? []}
        dietPreferences={profile?.diet_preferences ?? []}
      />
      <WaterTracker date={date} logs={day.water} totalMl={day.waterMl} goalMl={prefs?.water_goal_ml ?? 2500} />
    </div>
  );
}
