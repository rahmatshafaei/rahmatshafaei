import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getProfile } from "@/lib/data/profile";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Kom igång" };

export default async function OnboardingPage() {
  const auth = await requireAuth();
  const profile = await getProfile(auth);
  if (profile?.onboarding_completed_at) redirect("/hem");
  return <OnboardingWizard />;
}
