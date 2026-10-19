import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { activeDurationSeconds, formatDuration } from "@/lib/workout/logic";

export const metadata: Metadata = { title: "Träningshistorik" };

export default async function HistoryPage() {
  const auth = await requireAuth();
  const { data } = await auth.supabase
    .from("workout_sessions")
    .select("id, name, status, started_at, completed_at, paused_seconds, paused_at, session_sets(is_completed, weight_kg, reps)")
    .eq("user_id", auth.userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(100);
  const sessions = data ?? [];
  return (
    <>
      <PageHeader title="Historik" description="Genomförda pass. Avbrutna pass räknas inte." />
      {sessions.length ? (
        <Card>
          <CardContent className="pt-2">
            <ul className="divide-y">
              {sessions.map((s) => {
                const done = s.session_sets.filter((x) => x.is_completed);
                const volume = done.reduce((sum, x) => sum + Number(x.weight_kg) * (x.reps ?? 0), 0);
                return (
                  <li key={s.id}>
                    <Link href={`/traning/pass/${s.id}`} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(s.completed_at!)}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground tabular">
                        <p>{formatDuration(activeDurationSeconds(s))}</p>
                        <p>
                          {done.length} set · {Math.round(volume).toLocaleString("sv-SE")} kg
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={History} title="Inga genomförda pass ännu" description="Starta ett pass från översikten. När du avslutar det hamnar det här." />
      )}
    </>
  );
}
