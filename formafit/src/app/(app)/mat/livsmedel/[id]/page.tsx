import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice, PageHeader } from "@/components/ui/feedback";
import { MediaThumb } from "@/components/shared/media-thumb";
import { VerificationBadge } from "@/components/nutrition/verification-badge";
import { requireAuth } from "@/lib/auth";
import { getFoodsByIds } from "@/lib/data/foods";
import { GROCERY_CATEGORIES, PREPARATION_LABELS } from "@/lib/grocery/aggregate";
import { SOURCE_LABELS } from "@/lib/labels";
import { ALLERGENS } from "@/lib/nutrition/allergens";
import { uuid } from "@/lib/validation";
import { FoodForm } from "../food-form";
import { ArchiveFoodButton } from "./archive-button";

export const metadata: Metadata = { title: "Livsmedel" };

export default async function FoodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const auth = await requireAuth();
  const [food] = await getFoodsByIds(auth, [id]);
  if (!food) notFound();
  const { data: meta } = await auth.supabase.from("foods").select("source_ref, source_note").eq("id", id).single();

  return (
    <>
      <PageHeader title={food.name} description={food.brand ?? undefined} eyebrow={<VerificationBadge verification={food.verification} />} />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="flex flex-col gap-4">
          <MediaThumb src={food.imageUrl} alt={food.name} kind="food" category={food.category} size="lg" />
          {food.imageCredit ? <p className="text-xs text-muted-foreground">Bild: {food.imageCredit}</p> : null}
          <Card>
            <CardContent className="pt-5 text-sm">
              <dl className="grid grid-cols-2 gap-y-2">
                <dt className="text-muted-foreground">Källa</dt>
                <dd>{SOURCE_LABELS[food.source]}</dd>
                <dt className="text-muted-foreground">Kategori</dt>
                <dd>{GROCERY_CATEGORIES.find((c) => c.key === food.category)?.label}</dd>
                {food.preparation !== "as_sold" ? (
                  <>
                    <dt className="text-muted-foreground">Tillstånd</dt>
                    <dd>{PREPARATION_LABELS[food.preparation]}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Allergener</dt>
                <dd>{food.allergens.length ? food.allergens.map((a) => ALLERGENS[a as keyof typeof ALLERGENS] ?? a).join(", ") : "Inga angivna"}</dd>
              </dl>
              {meta?.source_ref ? (
                <a href={meta.source_ref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-primary-strong underline">
                  Visa källa
                </a>
              ) : null}
              {meta?.source_note ? <p className="mt-3 text-xs text-muted-foreground">{meta.source_note}</p> : null}
            </CardContent>
          </Card>
          {!food.allergens_known ? <Notice variant="warning">Allergeninformationen är inte bekräftad – läs förpackningen.</Notice> : null}
        </div>
        {food.isOwn ? (
          <Card>
            <CardHeader>
              <CardTitle>Redigera</CardTitle>
            </CardHeader>
            <CardContent>
              <FoodForm food={food} />
              <div className="mt-6 border-t pt-4">
                <ArchiveFoodButton id={food.id} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Näringsvärde per 100 g</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {([
                  ["Energi", food.kcal_per_100g, "kcal"],
                  ["Protein", food.protein_per_100g, "g"],
                  ["Kolhydrater", food.carbs_per_100g, "g"],
                  ["Fett", food.fat_per_100g, "g"],
                  ["Fiber", food.fiber_per_100g, "g"],
                ] as const).map(([label, value, unit]) => (
                  <div key={label} className="rounded-2xl bg-surface-muted p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-semibold tabular">{value === null ? "Saknas" : `${Number(value).toLocaleString("sv-SE")} ${unit}`}</dd>
                  </div>
                ))}
              </dl>
              {food.servings.length ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Portioner: {food.servings.map((s) => `${s.label} (${s.grams} g)`).join(", ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
