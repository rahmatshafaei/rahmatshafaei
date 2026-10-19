import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getOpenSession, getProgramDetail } from "@/lib/data/workouts";
import { uuid } from "@/lib/validation";
import { ProgramEditor } from "./program-editor";

export const metadata: Metadata = { title: "Program" };

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const auth = await requireAuth();
  const [detail, open] = await Promise.all([getProgramDetail(auth, id), getOpenSession(auth)]);
  if (!detail) notFound();
  return <ProgramEditor detail={detail} hasOpenSession={Boolean(open)} />;
}
