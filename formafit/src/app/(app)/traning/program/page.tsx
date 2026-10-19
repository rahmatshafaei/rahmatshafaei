import type { Metadata } from "next";
import Link from "next/link";
import { Dumbbell, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth";
import { SPLIT_LABELS } from "@/lib/labels";
import { PROGRAM_TEMPLATES } from "@/lib/workout/templates";
import { NewProgramButton, TemplateButton } from "./program-buttons";

export const metadata: Metadata = { title: "Träningsprogram" };

export default async function ProgramsPage() {
  const auth = await requireAuth();
  const { data } = await auth.supabase
    .from("workout_programs")
    .select("id, name, split_type, is_active, source, program_days(is_rest_day)")
    .eq("user_id", auth.userId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });
  const programs = data ?? [];
  return (
    <>
      <PageHeader title="Träningsprogram" actions={<NewProgramButton />} />
      {programs.length ? (
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {programs.map((p) => {
            const training = p.program_days.filter((d) => !d.is_rest_day).length;
            return (
              <Link key={p.id} href={`/traning/program/${p.id}`}>
                <Card className="h-full p-5 transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{p.name}</h2>
                    <div className="flex gap-1">
                      {p.is_active ? <Badge variant="primary">Aktivt</Badge> : null}
                      {p.source === "ai" ? (
                        <Badge variant="info">
                          <Sparkles /> AI
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {SPLIT_LABELS[p.split_type]} · {training} träningsdagar
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState className="mb-10" icon={Dumbbell} title="Inga egna program ännu" description="Börja från en mall nedan eller skapa ett tomt program." />
      )}

      <h2 className="mb-3 text-lg font-semibold">Mallar</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {PROGRAM_TEMPLATES.map((t) => (
          <Card key={t.key} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{t.name}</h3>
              <Badge variant="outline">{t.level}</Badge>
            </div>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{t.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t.days.filter((d) => !d.rest).map((d) => d.name).join(" · ")}
            </p>
            <TemplateButton templateKey={t.key} />
          </Card>
        ))}
      </div>
    </>
  );
}
