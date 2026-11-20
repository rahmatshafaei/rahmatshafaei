import { redirect } from "next/navigation";
import { BottomNav, Sidebar } from "@/components/layout/app-nav";
import { OfflineBanner } from "@/components/pwa/service-worker";
import { requireAuth } from "@/lib/auth";
import { getProfile } from "@/lib/data/profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const profile = await getProfile(auth);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <OfflineBanner />
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-36 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
