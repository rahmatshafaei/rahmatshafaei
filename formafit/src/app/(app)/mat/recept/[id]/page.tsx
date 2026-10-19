import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth";
import { getFoodsByIds } from "@/lib/data/foods";
import { getProfile } from "@/lib/data/profile";
import { uuid } from "@/lib/validation";
import { RecipeEditor } from "./recipe-editor";

export const metadata: Metadata = { title: "Recept" };

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  const profile = await getProfile(auth);
  if (id === "ny") {
    return (
      <>
        <PageHeader title="Nytt recept" />
        <RecipeEditor allergies={profile?.allergies ?? []} />
      </>
    );
  }
  if (!uuid.safeParse(id).success) notFound();
  const { data: recipe } = await auth.supabase
    .from("recipes")
    .select("*, recipe_ingredients(food_id, quantity_g, position)")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!recipe) notFound();
  const foods = await getFoodsByIds(auth, recipe.recipe_ingredients.map((i) => i.food_id));
  const byId = new Map(foods.map((f) => [f.id, f]));
  const ingredients = recipe.recipe_ingredients
    .sort((a, b) => a.position - b.position)
    .filter((i) => byId.has(i.food_id))
    .map((i) => ({ food: byId.get(i.food_id)!, quantityG: Number(i.quantity_g) }));
  return (
    <>
      <PageHeader title={recipe.name} />
      <RecipeEditor
        allergies={profile?.allergies ?? []}
        recipe={{
          id: recipe.id,
          name: recipe.name,
          kind: recipe.kind as "recipe" | "meal",
          servings: Number(recipe.servings),
          instructions: recipe.instructions,
          prepMinutes: recipe.prep_minutes,
          notes: recipe.notes,
          defaultSlot: recipe.default_slot,
          ingredients,
        }}
      />
    </>
  );
}
