"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/choice";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select, UnitInput } from "@/components/ui/input";
import { GROCERY_CATEGORIES } from "@/lib/grocery/aggregate";
import { ALLERGY_OPTIONS } from "@/lib/options";
import type { FoodSummary } from "@/lib/types";
import { createFood, updateFood } from "../actions";

const PREP = [
  { value: "as_sold", label: "Som den säljs" },
  { value: "raw", label: "Rå" },
  { value: "cooked", label: "Tillagad" },
  { value: "dried", label: "Torr / okokt" },
];

export function FoodForm({ food, returnTo }: { food?: FoodSummary; returnTo?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [image, setImage] = useState<File | null>(null);
  const [s, setS] = useState({
    name: food?.name ?? "",
    brand: food?.brand ?? "",
    barcode: food?.barcode ?? "",
    category: food?.category ?? "other",
    preparation: food?.preparation ?? "as_sold",
    kcal_per_100g: food?.kcal_per_100g?.toString() ?? "",
    protein_per_100g: food?.protein_per_100g?.toString() ?? "",
    carbs_per_100g: food?.carbs_per_100g?.toString() ?? "",
    fat_per_100g: food?.fat_per_100g?.toString() ?? "",
    fiber_per_100g: food?.fiber_per_100g?.toString() ?? "",
    allergens: food?.allergens ?? [],
    allergens_known: food?.allergens_known ?? false,
    diet_tags: food?.diet_tags ?? [],
    servings: food?.servings.map((x) => ({ label: x.label, grams: String(x.grams) })) ?? [],
  });
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((p) => ({ ...p, [k]: v }));

  const n = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const p = n(s.protein_per_100g) ?? 0;
  const c = n(s.carbs_per_100g) ?? 0;
  const f = n(s.fat_per_100g) ?? 0;
  const fib = n(s.fiber_per_100g) ?? 0;
  const derivedKcal = 4 * p + 4 * c + 9 * f + 2 * fib;
  const kcal = n(s.kcal_per_100g);
  const mismatch = kcal !== null && derivedKcal > 0 && Math.abs(kcal - derivedKcal) / Math.max(kcal, 1) > 0.15;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("data", JSON.stringify(s));
        if (image) fd.set("image", image);
        start(async () => {
          const res = food ? await updateFood(food.id, fd) : await createFood(fd);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            return void toast.error(res.error);
          }
          toast.success(food ? "Livsmedlet är uppdaterat" : "Livsmedlet är skapat");
          router.push(returnTo ?? `/mat/livsmedel/${res.data.id}`);
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Namn" htmlFor="f-name" error={errors.name}>
          <Input id="f-name" value={s.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label="Märke" htmlFor="f-brand" optional>
          <Input id="f-brand" value={s.brand} onChange={(e) => set("brand", e.target.value)} />
        </Field>
        <Field label="Kategori i butiken" htmlFor="f-cat">
          <Select id="f-cat" value={s.category} onChange={(e) => set("category", e.target.value as typeof s.category)}>
            {GROCERY_CATEGORIES.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tillstånd" htmlFor="f-prep" hint="Rått och tillagat räknas som olika varor i inköpslistan.">
          <Select id="f-prep" value={s.preparation} onChange={(e) => set("preparation", e.target.value as typeof s.preparation)}>
            {PREP.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Streckkod" htmlFor="f-barcode" optional error={errors.barcode}>
          <Input id="f-barcode" inputMode="numeric" value={s.barcode} onChange={(e) => set("barcode", e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>

      <fieldset className="rounded-2xl border p-4">
        <legend className="px-1 text-sm font-medium">Näringsvärde per 100 g</legend>
        <p className="mb-3 text-xs text-muted-foreground">Fyll i värdena från förpackningen. Lämna tomt om ett värde saknas – vi gissar aldrig.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {([
            ["kcal_per_100g", "Energi", "kcal"],
            ["protein_per_100g", "Protein", "g"],
            ["carbs_per_100g", "Kolhydrater", "g"],
            ["fat_per_100g", "Fett", "g"],
            ["fiber_per_100g", "Fiber", "g"],
          ] as const).map(([key, label, unit]) => (
            <Field key={key} label={label} htmlFor={`f-${key}`} error={errors[key]}>
              <UnitInput unit={unit} id={`f-${key}`} value={s[key]} onChange={(e) => set(key, e.target.value)} />
            </Field>
          ))}
        </div>
        {mismatch ? (
          <Notice variant="warning" className="mt-3">
            Energin ({kcal} kcal) stämmer dåligt med makronas {Math.round(derivedKcal)} kcal. Kontrollera värdena.
          </Notice>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Portioner</span>
        {s.servings.map((sv, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label="Portionsnamn"
              placeholder="T.ex. 1 skiva"
              value={sv.label}
              onChange={(e) => set("servings", s.servings.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            />
            <UnitInput
              unit="g"
              aria-label="Gram per portion"
              className="w-32 shrink-0"
              value={sv.grams}
              onChange={(e) => set("servings", s.servings.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Ta bort portion" onClick={() => set("servings", s.servings.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set("servings", [...s.servings, { label: "", grams: "" }])}>
          <Plus /> Lägg till portion
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Allergener</span>
        <ChipGroup label="Allergener" values={s.allergens} onChange={(v) => set("allergens", v)} options={ALLERGY_OPTIONS} />
        <label className="mt-1 flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={s.allergens_known} onChange={(e) => set("allergens_known", e.target.checked)} />
          Jag har kontrollerat allergeninformationen på förpackningen
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Kost</span>
        <ChipGroup
          label="Kost"
          values={s.diet_tags}
          onChange={(v) => set("diet_tags", v)}
          options={[
            { value: "vegetarian", label: "Vegetarisk" },
            { value: "vegan", label: "Vegansk" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Bild (valfritt)</span>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground hover:border-primary/40">
          <ImagePlus className="size-5" aria-hidden />
          {image ? image.name : "Ladda upp en egen bild (JPEG, PNG eller WebP, max 5 MB)"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {food ? "Spara ändringar" : "Skapa livsmedel"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}
