import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getSessionDetail } from "@/lib/data/workouts";
import { uuid } from "@/lib/validation";
import { ActiveWorkout } from "./active-workout";
import { SessionSummary } from "./session-summary";

export const metadata: Metadata = { title: "Pass" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const auth = await requireAuth();
  const detail = await getSessionDetail(auth, id);
  if (!detail) notFound();
  if (detail.session.status === "completed" || detail.session.status === "abandoned") return <SessionSummary detail={detail} />;
  return <ActiveWorkout detail={detail} />;
}
