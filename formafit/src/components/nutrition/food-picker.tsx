"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Barcode, ChefHat, Clock, Loader2, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { importExternalFood, listQuickFoods, listRecipes, searchFoods, toggleFavorite } from "@/app/(app)/mat/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Field, Input, UnitInput } from "@/components/ui/input";
import { MediaThumb } from "@/components/shared/media-thumb";
import { checkSuitability } from "@/lib/nutrition/allergens";
import { formatNutrient, isValidQuantity, scaleNutrients, toPer100g, type NutrientTotals } from "@/lib/nutrition/engine";
import type { ExternalFoodResult, FoodSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BarcodeScanner } from "./barcode-scanner";
import { MacroLine } from "./macro-bar";
import { VerificationBadge } from "./verification-badge";

type Tab = "search" | "favorites" | "recent" | "recipes" | "barcode";

interface RecipeOption {
  id: string;
  name: string;
  kind: string;
  servings: number;
  perServing: NutrientTotals;
}

export interface FoodPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel?: string;
  /** Return true to close the dialog. */
  onConfirm: (food: FoodSummary, grams: number) => Promise<boolean>;
  onLogRecipe?: (recipeId: string, portions: number) => Promise<boolean>;
  allergies?: string[];
  dietPreferences?: string[];
  initialGrams?: number;
}

export function FoodPicker({ open, onOpenChange, title, confirmLabel = "Lägg till", onConfirm, onLogRecipe, allergies = [], dietPreferences = [], initialGrams }: FoodPickerProps) {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [local, setLocal] = useState<FoodSummary[] | null>(null);
  const [external, setExternal] = useState<ExternalFoodResult[]>([]);
  const [externalStatus, setExternalStatus] = useState<string>("skipped");
  const [quick, setQuick] = useState<{ favorites: FoodSummary[]; recent: FoodSummary[]; favoriteIds: string[] } | null>(null);
  const [recipes, setRecipes] = useState<RecipeOption[] | null>(null);
  const [selected, setSelected] = useState<FoodSummary | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, start] = useTransition();
  const requestId = useRef(0);

  useEffect(() => {
    if (open) listQuickFoods().then((res) => res.ok && setQuick(res.data));
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelected(null);
      setSelectedRecipe(null);
    }
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open || tab !== "search") return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await searchFoods(query);
      if (id !== requestId.current) return;
      setSearching(false);
      if (!res.ok) return void toast.error(res.error);
      setLocal(res.data.local);
      setExternal(res.data.external);
      setExternalStatus(res.data.externalStatus);
    }, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, open, tab]);

  useEffect(() => {
    if (open && tab === "recipes" && recipes === null) {
      listRecipes().then((res) => res.ok && setRecipes(res.data));
    }
  }, [open, tab, recipes]);

  const favoriteIds = new Set(quick?.favoriteIds ?? []);

  function pickExternal(item: ExternalFoodResult) {
    start(async () => {
      const res = await importExternalFood(item.barcode);
      if (!res.ok) return void toast.error(res.error);
      setSelected(res.data);
    });
  }

  const content = selected ? (
    <QuantityStep
      food={selected}
      favorite={favoriteIds.has(selected.id)}
      onFavoriteChange={(fav) =>
        setQuick((q) => (q ? { ...q, favoriteIds: fav ? [...q.favoriteIds, selected.id] : q.favoriteIds.filter((x) => x !== selected.id) } : q))
      }
      allergies={allergies}
      dietPreferences={dietPreferences}
      confirmLabel={confirmLabel}
      initialGrams={initialGrams}
      onBack={() => setSelected(null)}
      onConfirm={async (grams) => {
        const close = await onConfirm(selected, grams);
        if (close) handleOpenChange(false);
      }}
    />
  ) : selectedRecipe && onLogRecipe ? (
    <RecipeStep
      recipe={selectedRecipe}
      onBack={() => setSelectedRecipe(null)}
      onConfirm={async (portions) => {
        const close = await onLogRecipe(selectedRecipe.id, portions);
        if (close) handleOpenChange(false);
      }}
    />
  ) : (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-none" role="tablist" aria-label="Sätt att hitta livsmedel">
        {(
          [
            ["search", "Sök", Search],
            ["favorites", "Favoriter", Star],
            ["recent", "Senaste", Clock],
            ...(onLogRecipe ? ([["recipes", "Recept & måltider", ChefHat]] as const) : []),
            ["barcode", "Streckkod", Barcode],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap",
              tab === key ? "border-primary bg-primary-soft text-primary-strong" : "bg-surface text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              autoFocus
              type="search"
              placeholder="Sök livsmedel eller märke…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              aria-label="Sök livsmedel"
            />
            {searching ? <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
          </div>
          <FoodList foods={local ?? []} onPick={setSelected} favoriteIds={favoriteIds} loading={local === null} />
          {local !== null && local.length === 0 && !searching ? (
            <p className="text-center text-sm text-muted-foreground">Inga träffar i din databas.</p>
          ) : null}
          {external.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Från Open Food Facts (communitydata)</p>
              {external.map((item) => (
                <button
                  key={item.barcode}
                  onClick={() => pickExternal(item)}
                  disabled={pending}
                  className="flex items-center gap-3 rounded-2xl border bg-surface p-2.5 text-left hover:border-primary/40"
                >
                  <MediaThumb src={item.imageUrl} alt="" kind="food" size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.brand ? `${item.brand} · ` : ""}
                      {item.kcal_per_100g !== null ? `${Math.round(item.kcal_per_100g)} kcal/100 g` : "Energi saknas"}
                    </span>
                  </span>
                  <Plus className="size-4 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </div>
          ) : null}
          {externalStatus === "unavailable" ? (
            <p className="text-center text-xs text-muted-foreground">Open Food Facts kunde inte nås just nu – visar endast din databas.</p>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/mat/livsmedel/ny">
              <Plus /> Skapa eget livsmedel
            </Link>
          </Button>
        </>
      )}

      {tab === "favorites" &&
        (quick?.favorites.length ? (
          <FoodList foods={quick.favorites} onPick={setSelected} favoriteIds={favoriteIds} />
        ) : (
          <EmptyState icon={Star} title="Inga favoriter ännu" description="Tryck på stjärnan när du väljer ett livsmedel för att spara det här." />
        ))}

      {tab === "recent" &&
        (quick?.recent.length ? (
          <FoodList foods={quick.recent} onPick={setSelected} favoriteIds={favoriteIds} />
        ) : (
          <EmptyState icon={Clock} title="Inget loggat ännu" description="Livsmedel du loggar visas här för snabb åtkomst." />
        ))}

      {tab === "recipes" &&
        (recipes === null ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        ) : recipes.length ? (
          <div className="flex flex-col gap-2">
            {recipes.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRecipe(r)}
                className="flex items-center gap-3 rounded-2xl border bg-surface p-3 text-left hover:border-primary/40"
              >
                <MediaThumb alt="" kind="meal" size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <MacroLine totals={r.perServing} className="text-xs" />
                </span>
                <span className="text-xs text-muted-foreground">/ portion</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ChefHat}
            title="Inga recept eller sparade måltider"
            description="Skapa recept under Recept & måltider eller spara en måltid från dagboken."
          />
        ))}

      {tab === "barcode" && <BarcodeScanner onFound={setSelected} />}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent title={title} className="sm:min-h-[32rem]">
        {content}
      </DialogContent>
    </Dialog>
  );
}

function FoodList({ foods, onPick, favoriteIds, loading }: { foods: FoodSummary[]; onPick: (f: FoodSummary) => void; favoriteIds: Set<string>; loading?: boolean }) {
  if (loading) return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  return (
    <ul className="flex flex-col gap-2">
      {foods.map((f) => (
        <li key={f.id}>
          <button
            onClick={() => onPick(f)}
            className="flex w-full items-center gap-3 rounded-2xl border bg-surface p-2.5 text-left transition-colors hover:border-primary/40"
          >
            <MediaThumb src={f.imageUrl} alt="" kind="food" category={f.category} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-medium">{f.name}</span>
                {favoriteIds.has(f.id) ? <Star className="size-3.5 shrink-0 fill-[var(--macro-carbs)] text-macro-carbs" aria-label="Favorit" /> : null}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {f.brand ? `${f.brand} · ` : ""}
                {f.kcal_per_100g !== null ? `${Math.round(f.kcal_per_100g)} kcal` : "kcal saknas"} · P {f.protein_per_100g ?? "–"} g per 100 g
              </span>
            </span>
            <VerificationBadge verification={f.verification} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function QuantityStep({
  food,
  favorite,
  onFavoriteChange,
  allergies,
  dietPreferences,
  confirmLabel,
  initialGrams,
  onBack,
  onConfirm,
}: {
  food: FoodSummary;
  favorite: boolean;
  onFavoriteChange: (fav: boolean) => void;
  allergies: string[];
  dietPreferences: string[];
  confirmLabel: string;
  initialGrams?: number;
  onBack: () => void;
  onConfirm: (grams: number) => Promise<void>;
}) {
  const [grams, setGrams] = useState(String(initialGrams ?? food.servings[0]?.grams ?? 100));
  const [pending, start] = useTransition();
  const value = Number(grams.replace(",", "."));
  const valid = isValidQuantity(value);
  const per100 = toPer100g(food);
  const totals = useMemo(() => (valid ? scaleNutrients(per100, value) : null), [valid, value, per100]);
  const suitability = checkSuitability(food, allergies, dietPreferences);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!valid) return;
        start(() => onConfirm(value));
      }}
    >
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Tillbaka
      </button>
      <div className="flex items-start gap-3">
        <MediaThumb src={food.imageUrl} alt={food.name} kind="food" category={food.category} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{food.name}</h3>
          {food.brand ? <p className="text-sm text-muted-foreground">{food.brand}</p> : null}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <VerificationBadge verification={food.verification} />
          </div>
          {food.imageCredit ? <p className="mt-1 text-[11px] text-muted-foreground">Bild: {food.imageCredit}</p> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={favorite ? "Ta bort från favoriter" : "Spara som favorit"}
          aria-pressed={favorite}
          onClick={async () => {
            const res = await toggleFavorite(food.id);
            if (res.ok) onFavoriteChange(res.data.favorite);
          }}
        >
          <Star className={cn(favorite && "fill-[var(--macro-carbs)] text-macro-carbs")} />
        </Button>
      </div>

      {suitability.status === "conflict" ? (
        <Notice variant="danger" title="Passar inte dina val">
          {suitability.reasons.join(". ")}.
        </Notice>
      ) : suitability.status === "unknown" ? (
        <Notice variant="warning">{suitability.reasons[0]}</Notice>
      ) : null}
      {food.verification === "estimated" ? (
        <p className="text-xs text-muted-foreground">Näringsvärdena är ungefärliga referensvärden – kontrollera mot förpackningen.</p>
      ) : null}

      <Field label="Mängd" htmlFor="qty" error={!valid && grams ? "Ange 1–5000 g." : undefined}>
        <UnitInput unit="g" id="qty" autoFocus value={grams} onChange={(e) => setGrams(e.target.value)} aria-invalid={!valid} />
      </Field>
      {food.servings.length ? (
        <div className="flex flex-wrap gap-2">
          {food.servings.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setGrams(String(s.grams))}
              className="rounded-full border bg-surface px-3 py-1.5 text-sm hover:border-primary/40"
            >
              {s.label} <span className="text-muted-foreground">({s.grams} g)</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-surface-muted p-3 text-center text-sm tabular">
        {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
          <div key={k}>
            <p className="text-xs text-muted-foreground">{{ kcal: "kcal", protein: "Protein", carbs: "Kolh.", fat: "Fett" }[k]}</p>
            <p className="font-semibold">
              {totals ? (per100[k] === null ? "–" : `${formatNutrient(totals[k], k)}${k === "kcal" ? "" : " g"}`) : "–"}
            </p>
          </div>
        ))}
      </div>
      {totals?.missing.length ? <p className="text-xs text-warning">Vissa näringsvärden saknas för det här livsmedlet.</p> : null}

      <Button type="submit" size="lg" disabled={!valid} loading={pending}>
        {confirmLabel}
      </Button>
    </form>
  );
}

function RecipeStep({ recipe, onBack, onConfirm }: { recipe: RecipeOption; onBack: () => void; onConfirm: (portions: number) => Promise<void> }) {
  const [portions, setPortions] = useState("1");
  const [pending, start] = useTransition();
  const p = Number(portions.replace(",", "."));
  const valid = Number.isFinite(p) && p > 0 && p <= 20;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (valid) start(() => onConfirm(p));
      }}
    >
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Tillbaka
      </button>
      <h3 className="font-semibold">{recipe.name}</h3>
      <p className="text-sm text-muted-foreground">
        Receptet ger {recipe.servings.toLocaleString("sv-SE")} portion{recipe.servings === 1 ? "" : "er"}. Ingredienserna loggas var för sig.
      </p>
      <Field label="Antal portioner" htmlFor="portions">
        <UnitInput unit="port." id="portions" value={portions} onChange={(e) => setPortions(e.target.value)} />
      </Field>
      {valid ? (
        <MacroLine
          totals={{
            kcal: recipe.perServing.kcal * p,
            protein: recipe.perServing.protein * p,
            carbs: recipe.perServing.carbs * p,
            fat: recipe.perServing.fat * p,
            missing: recipe.perServing.missing,
          }}
        />
      ) : null}
      <Button type="submit" size="lg" disabled={!valid} loading={pending}>
        Logga {recipe.kind === "meal" ? "måltid" : "recept"}
      </Button>
    </form>
  );
}
