import type { Metadata } from "next";
import Link from "next/link";
import { ChefHat, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { MacroLine } from "@/components/nutrition/macro-bar";
import { MediaThumb } from "@/components/shared/media-thumb";
import { requireAuth } from "@/lib/auth";
import { recipeNutrition, toPer100g } from "@/lib/nutrition/engine";
import { signedUrls } from "@/lib/services/storage";

export const metadata: Metadata = { title: "Recept & måltider" };

export default async function RecipesPage() {
  const auth = await requireAuth();
  const { data } = await auth.supabase
    .from("recipes")
    .select("id, name, kind, servings, prep_minutes, image_path, recipe_ingredients(quantity_g, foods(kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g))")
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false });
  const recipes = data ?? [];
  const urls = await signedUrls(auth, "user-media", recipes.map((r) => r.image_path));
  return (
    <>
      <PageHeader
        title="Recept & sparade måltider"
        description="Återanvänd i dagboken och i måltidsplaner. Näringen räknas från ingredienserna."
        actions={
          <Button asChild>
            <Link href="/mat/recept/ny">
              <Plus /> Nytt recept
            </Link>
          </Button>
        }
      />
      {recipes.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => {
            const n = recipeNutrition(
              r.recipe_ingredients.filter((i) => i.foods).map((i) => ({ per100: toPer100g(i.foods!), quantityG: Number(i.quantity_g) })),
              Number(r.servings),
            );
            return (
              <Link key={r.id} href={`/mat/recept/${r.id}`}>
                <Card className="h-full p-4 transition-colors hover:border-primary/40">
                  <MediaThumb src={r.image_path ? urls.get(r.image_path) : null} alt="" kind="meal" size="lg" className="mb-3 aspect-[16/9]" />
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate font-semibold">{r.name}</h2>
                    <Badge variant={r.kind === "meal" ? "info" : "primary"}>{r.kind === "meal" ? "Måltid" : "Recept"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Number(r.servings).toLocaleString("sv-SE")} portion{Number(r.servings) === 1 ? "" : "er"}
                    {r.prep_minutes ? ` · ${r.prep_minutes} min` : ""} · per portion:
                  </p>
                  <MacroLine totals={n.perServing} className="text-xs" />
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ChefHat}
          title="Inga recept ännu"
          description="Skapa ditt första recept eller spara en måltid direkt från dagboken."
          action={
            <Button asChild>
              <Link href="/mat/recept/ny">Skapa recept</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
