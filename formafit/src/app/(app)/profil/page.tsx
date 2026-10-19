import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth";
import { getPreferences, getProfile, getTargets } from "@/lib/data/profile";
import { isAiConfigured } from "@/lib/env";
import { PreferencesForm, ProfileForm, TargetsCard } from "./profile-forms";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const auth = await requireAuth();
  const [profile, targets, prefs] = await Promise.all([getProfile(auth), getTargets(auth), getPreferences(auth)]);
  if (!profile || !prefs) return null;
  return (
    <>
      <PageHeader title="Profil" description={auth.email ?? undefined} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <TargetsCard targets={targets} waterGoalMl={prefs.water_goal_ml} />
          <Card>
            <CardHeader>
              <CardTitle>Om dig</CardTitle>
              <CardDescription>Ändringar här påverkar inte dina mål förrän du själv räknar om dem.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm profile={profile} />
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Inställningar</CardTitle>
            </CardHeader>
            <CardContent>
              <PreferencesForm prefs={prefs} aiConfigured={isAiConfigured()} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Konto</CardTitle>
              <CardDescription>Enheter: kilogram, centimeter och gram.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action="/auth/logout" method="post">
                <Button variant="outline" className="w-full">
                  <LogOut /> Logga ut
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
