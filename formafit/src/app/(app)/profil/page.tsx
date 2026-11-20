import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth";
import { LogoutForm } from "@/components/layout/logout-form";
import { getPreferences, getProfile, getTargets } from "@/lib/data/profile";
import { hasScheduledTrainingDays } from "@/lib/data/workouts";
import { isAiConfigured, pushEnv } from "@/lib/env";
import { DataCard } from "./data-card";
import { PreferencesForm, ProfileForm, TargetsCard } from "./profile-forms";
import { RemindersCard } from "./reminders-card";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const auth = await requireAuth();
  const [profile, targets, prefs, scheduledDays] = await Promise.all([
    getProfile(auth),
    getTargets(auth),
    getPreferences(auth),
    hasScheduledTrainingDays(auth),
  ]);
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
          <RemindersCard
            vapidPublicKey={pushEnv()?.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
            hasScheduledDays={scheduledDays}
            settings={{ timezone: prefs.reminder_timezone, workoutTime: prefs.workout_reminder_time, mealTime: prefs.meal_reminder_time }}
          />
          <Card>
            <CardHeader>
              <CardTitle>Konto</CardTitle>
              <CardDescription>Enheter: kilogram, centimeter och gram.</CardDescription>
            </CardHeader>
            <CardContent>
              <LogoutForm>
                <Button variant="outline" className="w-full">
                  <LogOut /> Logga ut
                </Button>
              </LogoutForm>
            </CardContent>
          </Card>
          <DataCard />
        </div>
      </div>
    </>
  );
}
