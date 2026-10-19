"use client";
import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { formatNutrient, type NutrientDiff, type NutrientTotals } from "@/lib/nutrition/engine";
import type { Suitability } from "@/lib/nutrition/allergens";
import type { FoodSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getSubstitutes, replaceIngredient } from "../actions";
import { aiRankSubstitutes } from "../ai-actions";

interface Option {
  food: FoodSummary;
  quantityG: number;
  original: NutrientTotals;
  replacement: NutrientTotals;
  diff: NutrientDiff;
  suitability: Suitability;
  reason?: string;
}

function DiffCell({ value, unit }: { value: number; unit: string }) {
  const rounded = unit === "kcal" ? Math.round(value) : Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return (
    <span className={cn("tabular", Math.abs(rounded) < (unit === "kcal" ? 15 : 2) ? "text-muted-foreground" : rounded > 0 ? "text-warning" : "text-info")}>
      {sign}
      {rounded.toLocaleString("sv-SE")} {unit}
    </span>
  );
}

export function SubstitutionDialog({
  ingredientId,
  onClose,
  onReplaced,
  aiEnabled,
}: {
  ingredientId: string | null;
  onClose: () => void;
  onReplaced: () => void;
  aiEnabled: boolean;
}) {
  return (
    <Dialog open={ingredientId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Byt ingrediens" description="Mängden räknas fram från livsmedelsdatabasen för att hålla makrona nära originalet." wide>
        {ingredientId ? <SubstitutionContent key={ingredientId} ingredientId={ingredientId} onClose={onClose} onReplaced={onReplaced} aiEnabled={aiEnabled} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SubstitutionContent({
  ingredientId,
  onClose,
  onReplaced,
  aiEnabled,
}: {
  ingredientId: string;
  onClose: () => void;
  onReplaced: () => void;
  aiEnabled: boolean;
}) {
  const [data, setData] = useState<{ original: FoodSummary; quantityG: number; options: Option[] } | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [pending, start] = useTransition();

  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getSubstitutes(ingredientId).then((res) => {
      if (!res.ok) setError(res.error);
      else setData(res.data);
    });
  }, [ingredientId]);

  async function askAi() {
    setAiLoading(true);
    const res = await aiRankSubstitutes(ingredientId);
    setAiLoading(false);
    if (!res.ok) return void toast.error(res.error);
    setData((d) => (d ? { ...d, options: res.data.options } : d));
    setAiNote(res.data.note);
  }

  if (error) return <Notice variant="danger">{error}</Notice>;
  return (
    <>
        {!data ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-surface-muted p-3 text-sm">
              <p className="text-muted-foreground">Original</p>
              <p className="font-medium">
                {data.original.name} · {data.quantityG} g
              </p>
              {data.options[0] ? (
                <p className="tabular text-muted-foreground">
                  {formatNutrient(data.options[0].original.kcal, "kcal")} kcal · P {formatNutrient(data.options[0].original.protein, "protein")} g · K{" "}
                  {formatNutrient(data.options[0].original.carbs, "carbs")} g · F {formatNutrient(data.options[0].original.fat, "fat")} g
                </p>
              ) : null}
            </div>
            {aiEnabled ? (
              <Button variant="outline" onClick={askAi} loading={aiLoading} className="self-start">
                <Sparkles /> Låt AI välja bland alternativen
              </Button>
            ) : null}
            {aiNote ? <Notice>{aiNote}</Notice> : null}
            {data.options.length ? (
              <ul className="flex flex-col gap-2">
                {data.options.map((o) => (
                  <li key={o.food.id} className="rounded-2xl border bg-surface p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{data.original.name}</span>
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                      <span className="font-medium">
                        {o.food.name} · {o.quantityG} g
                      </span>
                      {o.suitability.status === "unknown" ? <Badge variant="warning">Allergeninfo osäker</Badge> : null}
                    </div>
                    {o.reason ? <p className="mt-1 text-sm text-muted-foreground">{o.reason}</p> : null}
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                      <span>
                        Energi <DiffCell value={o.diff.kcal} unit="kcal" />
                      </span>
                      <span>
                        Protein <DiffCell value={o.diff.protein} unit="g" />
                      </span>
                      <span>
                        Kolh. <DiffCell value={o.diff.carbs} unit="g" />
                      </span>
                      <span>
                        Fett <DiffCell value={o.diff.fat} unit="g" />
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        loading={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await replaceIngredient({ id: ingredientId, foodId: o.food.id, quantityG: o.quantityG });
                            if (!res.ok) return void toast.error(res.error);
                            toast.success(`Bytt till ${o.food.name}`);
                            onReplaced();
                            onClose();
                          })
                        }
                      >
                        Använd
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Notice>Inga lämpliga alternativ hittades i din livsmedelsdatabas.</Notice>
            )}
            <p className="text-xs text-muted-foreground">
              Alternativ som krockar med dina allergier eller kostval visas inte. Märkta alternativ har ofullständig allergeninformation och är
              inte garanterat säkra.
            </p>
          </div>
        )}
    </>
  );
}
