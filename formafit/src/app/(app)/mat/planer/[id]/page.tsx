import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getPlanDetail } from "@/lib/data/plans";
import { getProfile, getTargets } from "@/lib/data/profile";
import { isAiConfigured } from "@/lib/env";
import { todayIso } from "@/lib/dates";
import { uuid } from "@/lib/validation";
import { PlanEditor } from "./plan-editor";

export const metadata: Metadata = { title: "Måltidsplan" };

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dag?: string }> }) {
  const { id } = await params;
  const { dag } = await searchParams;
  if (!uuid.safeParse(id).success) notFound();
  const auth = await requireAuth();
  const [detail, targets, profile] = await Promise.all([getPlanDetail(auth, id), getTargets(auth), getProfile(auth)]);
  if (!detail) notFound();
  const dayParam = Number(dag);
  const initialDay = Number.isInteger(dayParam) && dayParam >= 0 && dayParam < detail.plan.num_days ? dayParam : 0;
  return (
    <PlanEditor
      key={detail.plan.id}
      detail={detail}
      targets={targets}
      initialDay={initialDay}
      today={todayIso()}
      allergies={profile?.allergies ?? []}
      dietPreferences={profile?.diet_preferences ?? []}
      aiEnabled={isAiConfigured()}
    />
  );
}
