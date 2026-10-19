"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea, UnitInput } from "@/components/ui/input";
import { FoodPicker } from "@/components/nutrition/food-picker";
import { IngredientRows, type DraftIngredient } from "@/components/nutrition/ingredient-list";
import { MacroLine } from "@/components/nutrition/macro-bar";
import { MEAL_SLOT_LABELS } from "@/lib/labels";
import { isValidQuantity, recipeNutrition, toPer100g } from "@/lib/nutrition/engine";
import type { FoodSummary, MealSlot } from "@/lib/types";
import { deleteRecipe, saveRecipe, setRecipeImage } from "../../actions";

interface RecipeData {
  id: string;
  name: string;
  kind: "recipe" | "meal";
  servings: number;
  instructions: string | null;
  prepMinutes: number | null;
  notes: string | null;
  defaultSlot: MealSlot | null;
  ingredients: { food: FoodSummary; quantityG: number }[];
}

export function RecipeEditor({ recipe, allergies }: { recipe?: RecipeData; allergies: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [s, setS] = useState({
    name: recipe?.name ?? "",
    kind: recipe?.kind ?? "recipe",
    servings: String(recipe?.servings ?? 1),
    prepMinutes: recipe?.prepMinutes?.toString() ?? "",
    instructions: recipe?.instructions ?? "",
    notes: recipe?.notes ?? "",
    defaultSlot: recipe?.defaultSlot ?? "",
  });
  const [items, setItems] = useState<DraftIngredient[]>(
    recipe?.ingredients.map((i) => ({ key: crypto.randomUUID(), food: i.food, quantity: String(i.quantityG) })) ?? [],
  );

  const servings = Number(s.servings.replace(",", "."));
  const nutrition = useMemo(() => {
    const portions = items
      .map((i) => ({ per100: toPer100g(i.food), quantityG: Number(i.quantity.replace(",", ".")) }))
      .filter((p) => isValidQuantity(p.quantityG));
    if (!portions.length || !(servings > 0)) return null;
    return recipeNutrition(portions, servings);
  }, [items, servings]);

  return (
    <form
      className="grid gap-6 lg:grid-cols-[1fr_20rem]"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveRecipe(recipe?.id ?? null, {
            ...s,
            defaultSlot: s.defaultSlot || null,
            ingredients: items.map((i) => ({ foodId: i.food.id, quantityG: i.quantity })),
          });
          if (!res.ok) return void toast.error(res.error);
          if (image) {
            const fd = new FormData();
            fd.set("image", image);
            const img = await setRecipeImage(res.data.id, fd);
            if (!img.ok) toast.error(img.error);
            else setImage(null);
          }
          toast.success("Sparat");
          if (!recipe) router.replace(`/mat/recept/${res.data.id}`);
          router.refresh();
        });
      }}
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <Field label="Namn" htmlFor="r-name" className="sm:col-span-2">
              <Input id="r-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} required />
            </Field>
            <Field label="Typ" htmlFor="r-kind">
              <Select id="r-kind" value={s.kind} onChange={(e) => setS({ ...s, kind: e.target.value as "recipe" | "meal" })}>
                <option value="recipe">Recept</option>
                <option value="meal">Sparad måltid</option>
              </Select>
            </Field>
            <Field label="Antal portioner" htmlFor="r-serv">
              <UnitInput unit="port." id="r-serv" value={s.servings} onChange={(e) => setS({ ...s, servings: e.target.value })} />
            </Field>
            <Field label="Tillagningstid" htmlFor="r-prep" optional>
              <UnitInput unit="min" id="r-prep" value={s.prepMinutes} onChange={(e) => setS({ ...s, prepMinutes: e.target.value })} />
            </Field>
            <Field label="Passar till" htmlFor="r-slot" optional>
              <Select id="r-slot" value={s.defaultSlot} onChange={(e) => setS({ ...s, defaultSlot: e.target.value as MealSlot | "" })}>
                <option value="">Valfri måltid</option>
                {Object.entries(MEAL_SLOT_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Ingredienser</CardTitle>
            <Button type="button" size="sm" variant="soft" onClick={() => setPickerOpen(true)}>
              <Plus /> Lägg till
            </Button>
          </CardHeader>
          <CardContent>
            {items.length ? (
              <IngredientRows
                items={items}
                onChange={(key, quantity) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, quantity } : x)))}
                onRemove={(key) => setItems((xs) => xs.filter((x) => x.key !== key))}
              />
            ) : (
              <EmptyState icon={Plus} title="Inga ingredienser" description="Lägg till ingredienser i gram – näringen räknas automatiskt." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-5">
            <Field label="Instruktioner" htmlFor="r-inst" optional>
              <Textarea id="r-inst" rows={6} value={s.instructions} onChange={(e) => setS({ ...s, instructions: e.target.value })} />
            </Field>
            <Field label="Anteckningar" htmlFor="r-notes" optional>
              <Textarea id="r-notes" rows={2} value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/40">
              <ImagePlus className="size-5" aria-hidden />
              {image ? image.name : "Ladda upp en egen bild på rätten (valfritt, max 5 MB)"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
            </label>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Näring</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {nutrition ? (
              <>
                <div>
                  <p className="text-muted-foreground">Hela receptet ({Math.round(nutrition.totalWeightG)} g)</p>
                  <MacroLine totals={nutrition.total} />
                </div>
                <div>
                  <p className="text-muted-foreground">Per portion</p>
                  <MacroLine totals={nutrition.perServing} />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Lägg till ingredienser för att se näringen.</p>
            )}
          </CardContent>
        </Card>
        <Button type="submit" size="lg" loading={pending} disabled={!items.length}>
          Spara
        </Button>
        {recipe ? (
          <Button type="button" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Ta bort
          </Button>
        ) : null}
      </div>

      <FoodPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Lägg till ingrediens"
        allergies={allergies}
        onConfirm={async (food, grams) => {
          setItems((xs) => [...xs, { key: crypto.randomUUID(), food, quantity: String(grams) }]);
          return true;
        }}
      />
      {recipe ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          destructive
          title="Ta bort receptet?"
          description="Receptet tas bort. Dagboksposter som redan loggats behålls."
          confirmLabel="Ta bort"
          onConfirm={async () => {
            const res = await deleteRecipe(recipe.id);
            if (!res.ok) return void toast.error(res.error);
            router.push("/mat/recept");
          }}
        />
      ) : null}
    </form>
  );
}
