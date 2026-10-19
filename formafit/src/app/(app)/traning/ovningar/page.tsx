import type { Metadata } from "next";
import Link from "next/link";
import { Dumbbell, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { MediaThumb } from "@/components/shared/media-thumb";
import { requireAuth } from "@/lib/auth";
import { listExercises } from "@/lib/data/workouts";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/labels";
import { LibraryFilters } from "./library-filters";

export const metadata: Metadata = { title: "Övningsbibliotek" };

export default async function ExerciseLibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; muskel?: string; utrustning?: string }> }) {
  const params = await searchParams;
  const auth = await requireAuth();
  const muscle = params.muskel && params.muskel in MUSCLE_LABELS ? params.muskel : undefined;
  const equipment = params.utrustning && params.utrustning in EQUIPMENT_LABELS ? params.utrustning : undefined;
  const exercises = await listExercises(auth, { q: params.q?.slice(0, 80), muscle, equipment });
  return (
    <>
      <PageHeader
        title="Övningsbibliotek"
        description="Bilder visas bara när de är egna uppladdningar eller kommer från en licensierad källa."
        actions={
          <Button asChild>
            <Link href="/traning/ovningar/ny">
              <Plus /> Egen övning
            </Link>
          </Button>
        }
      />
      <LibraryFilters q={params.q ?? ""} muscle={muscle ?? ""} equipment={equipment ?? ""} />
      {exercises.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((e) => (
            <Link key={e.id} href={`/traning/ovningar/${e.id}`}>
              <Card className="flex h-full items-center gap-3 p-3 transition-colors hover:border-primary/40">
                <MediaThumb src={e.imageUrl} alt="" kind="exercise" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.primaryMuscles.map((m) => MUSCLE_LABELS[m] ?? m).join(", ")}</p>
                  <div className="mt-1 flex gap-1">
                    <Badge variant="outline">{EQUIPMENT_LABELS[e.equipment] ?? e.equipment}</Badge>
                    {e.isOwn ? <Badge variant="info">Egen</Badge> : null}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState className="mt-4" icon={Dumbbell} title="Inga övningar hittades" description="Ändra filtren eller skapa en egen övning." />
      )}
    </>
  );
}
