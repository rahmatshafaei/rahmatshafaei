import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth";
import { addDays, formatDate, todayIso } from "@/lib/dates";
import { NewPlanButton } from "./new-plan-button";

export const metadata: Metadata = { title: "Måltidsplaner" };

export default async function PlansPage() {
  const auth = await requireAuth();
  const { data } = await auth.supabase
    .from("meal_plans")
    .select("id, name, start_date, num_days, source, created_at, planned_meals(count)")
    .eq("user_id", auth.userId)
    .is("archived_at", null)
    .order("start_date", { ascending: false });
  const plans = data ?? [];
  const today = todayIso();
  return (
    <>
      <PageHeader
        title="Måltidsplaner"
        description="Planerade måltider hålls separat från dagboken tills du markerar dem som ätna."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/mat/planer/generera">
                <Sparkles /> Generera med AI
              </Link>
            </Button>
            <NewPlanButton today={today} />
          </>
        }
      />
      {plans.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((p) => {
            const end = addDays(p.start_date, p.num_days - 1);
            const current = p.start_date <= today && end >= today;
            const mealCount = (p.planned_meals as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <Link key={p.id} href={`/mat/planer/${p.id}`}>
                <Card className="h-full p-5 transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{p.name}</h2>
                    <div className="flex gap-1">
                      {current ? <Badge variant="primary">Pågår</Badge> : null}
                      {p.source === "ai" ? (
                        <Badge variant="info">
                          <Sparkles /> AI-förslag
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(p.start_date)} – {formatDate(end)} · {p.num_days} {p.num_days === 1 ? "dag" : "dagar"} · {mealCount} måltider
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={CalendarRange}
          title="Inga måltidsplaner ännu"
          description="Skapa en dag- eller veckoplan manuellt eller låt AI föreslå en plan utifrån dina mål."
          action={<NewPlanButton today={today} />}
        />
      )}
    </>
  );
}
