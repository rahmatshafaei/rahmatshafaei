import type { Metadata } from "next";
import Link from "next/link";
import { Apple, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { MediaThumb } from "@/components/shared/media-thumb";
import { VerificationBadge } from "@/components/nutrition/verification-badge";
import { requireAuth } from "@/lib/auth";
import { searchLocalFoods } from "@/lib/data/foods";

export const metadata: Metadata = { title: "Livsmedel" };

export default async function FoodsPage({ searchParams }: { searchParams: Promise<{ q?: string; egna?: string }> }) {
  const { q = "", egna } = await searchParams;
  const auth = await requireAuth();
  const foods = (await searchLocalFoods(auth, q.slice(0, 100), 60)).filter((f) => (egna ? f.isOwn : true));
  return (
    <>
      <PageHeader
        title="Livsmedel"
        description="Startdata är ungefärliga referensvärden. Egna och importerade livsmedel visas bara för dig."
        actions={
          <Button asChild>
            <Link href="/mat/livsmedel/ny">
              <Plus /> Nytt livsmedel
            </Link>
          </Button>
        }
      />
      <form className="mb-4 flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Sök…" aria-label="Sök livsmedel" />
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input type="checkbox" name="egna" value="1" defaultChecked={!!egna} className="size-4 accent-[var(--primary)]" /> Endast egna
        </label>
        <Button type="submit" variant="outline">
          Sök
        </Button>
      </form>
      {foods.length ? (
        <Card>
          <CardContent className="pt-2">
            <ul className="divide-y">
              {foods.map((f) => (
                <li key={f.id}>
                  <Link href={`/mat/livsmedel/${f.id}`} className="flex items-center gap-3 py-3">
                    <MediaThumb src={f.imageUrl} alt="" kind="food" category={f.category} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {f.brand ? `${f.brand} · ` : ""}
                        {f.kcal_per_100g !== null ? `${Math.round(f.kcal_per_100g)} kcal` : "kcal saknas"} · P {f.protein_per_100g ?? "–"} · K {f.carbs_per_100g ?? "–"} · F{" "}
                        {f.fat_per_100g ?? "–"} g / 100 g
                      </span>
                    </span>
                    <VerificationBadge verification={f.verification} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={Apple} title="Inga livsmedel hittades" description="Prova ett annat sökord eller skapa ett eget livsmedel." />
      )}
    </>
  );
}
