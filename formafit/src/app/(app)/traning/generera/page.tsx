import type { Metadata } from "next";
import Link from "next/link";
import { Notice, PageHeader } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth";
import { getProfile } from "@/lib/data/profile";
import { isAiConfigured } from "@/lib/env";
import { WorkoutGenerator } from "./workout-generator";

export const metadata: Metadata = { title: "AI-träningsprogram" };

export default async function GenerateWorkoutPage() {
  const auth = await requireAuth();
  const profile = await getProfile(auth);
  const aiEnabled = isAiConfigured();
  return (
    <>
      <PageHeader
        title="AI-träningsprogram"
        eyebrow={
          <Link href="/traning/program" className="hover:underline">
            Program
          </Link>
        }
        description="AI:n väljer övningar ur ditt bibliotek. Du granskar och ändrar förslaget innan det sparas som ett nytt program."
      />
      {!aiEnabled ? (
        <Notice variant="warning" title="AI är inte konfigurerat" className="mb-4">
          Servern saknar ANTHROPIC_API_KEY. Du kan fortfarande använda mallarna under Program.
        </Notice>
      ) : null}
      <WorkoutGenerator
        aiEnabled={aiEnabled}
        defaults={{
          experience: profile?.experience ?? "beginner",
          goal: profile?.goal ?? "maintenance",
          daysPerWeek: Math.min(6, Math.max(1, profile?.training_days_per_week ?? 3)),
          equipment: profile?.equipment.length ? profile.equipment : ["bodyweight", "dumbbell"],
        }}
      />
    </>
  );
}
