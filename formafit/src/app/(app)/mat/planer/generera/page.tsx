import type { Metadata } from "next";
import Link from "next/link";
import { Notice, PageHeader } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth";
import { getProfile, getTargets } from "@/lib/data/profile";
import { addDays, mondayOf, todayIso } from "@/lib/dates";
import { isAiConfigured } from "@/lib/env";
import { MealPlanGenerator } from "./generator";

export const metadata: Metadata = { title: "Generera måltidsplan" };

export default async function GeneratePlanPage() {
  const auth = await requireAuth();
  const [targets, profile] = await Promise.all([getTargets(auth), getProfile(auth)]);
  const aiEnabled = isAiConfigured();
  return (
    <>
      <PageHeader
        title="Generera måltidsplan"
        eyebrow={
          <Link href="/mat/planer" className="hover:underline">
            Måltidsplaner
          </Link>
        }
        description="AI:n föreslår måltider av livsmedel i din databas. All näring räknas om av FormaFit och du granskar förslaget innan något sparas."
      />
      {!aiEnabled ? (
        <Notice variant="warning" title="AI är inte konfigurerat">
          Servern saknar ANTHROPIC_API_KEY. Du kan fortfarande skapa planer manuellt under Måltidsplaner.
        </Notice>
      ) : null}
      <MealPlanGenerator
        aiEnabled={aiEnabled}
        defaults={{
          calories: targets?.calories ?? 2200,
          protein_g: Number(targets?.protein_g ?? 140),
          carbs_g: Number(targets?.carbs_g ?? 230),
          fat_g: Number(targets?.fat_g ?? 70),
          mealsPerDay: Math.min(6, profile?.meals_per_day ?? 4),
          startDate: addDays(mondayOf(todayIso()), 7),
        }}
      />
    </>
  );
}
