"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import type { FoodSummary } from "@/lib/types";
import { getSubstitutesForFood } from "../actions";

type Options = Extract<Awaited<ReturnType<typeof getSubstitutesForFood>>, { ok: true }>["data"]["options"];

/** Side-by-side substitute picker for an unsaved draft ingredient. */
export function DraftSubstituteDialog({
  target,
  onClose,
  onChoose,
}: {
  target: { food: FoodSummary; grams: number } | null;
  onClose: () => void;
  onChoose: (food: FoodSummary, grams: number) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      {target ? (
        <DialogContent title={`Byt ut ${target.food.name}`} description={`${target.grams} g – mängden räknas om från databasen.`} wide>
          <DraftSubstituteOptions key={`${target.food.id}-${target.grams}`} target={target} onChoose={onChoose} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function DraftSubstituteOptions({
  target,
  onChoose,
}: {
  target: { food: FoodSummary; grams: number };
  onChoose: (food: FoodSummary, grams: number) => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);
  const foodId = target.food.id;
  const grams = target.grams;
  useEffect(() => {
    getSubstitutesForFood(foodId, grams).then((res) => {
      if (!res.ok) setError(res.error);
      else setOptions(res.data.options);
    });
  }, [foodId, grams]);
  if (error) return <Notice variant="danger">{error}</Notice>;
  const fmt = (v: number, unit: string) => `${v > 0 ? "+" : ""}${unit === "kcal" ? Math.round(v) : Math.round(v * 10) / 10} ${unit}`;
  return (
    <>
          {!options ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : options.length ? (
            <ul className="flex flex-col gap-2">
              {options.map((o) => (
                <li key={o.food.id} className="flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      {target.food.name} <ArrowRight className="size-3.5" aria-hidden /> {o.food.name} · {o.quantityG} g
                      {o.suitability.status === "unknown" ? <Badge variant="warning">Allergeninfo osäker</Badge> : null}
                    </p>
                    <p className="text-sm text-muted-foreground tabular">
                      {fmt(o.diff.kcal, "kcal")} · P {fmt(o.diff.protein, "g")} · K {fmt(o.diff.carbs, "g")} · F {fmt(o.diff.fat, "g")}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => onChoose(o.food, o.quantityG)}>
                    Använd
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Notice>Inga lämpliga alternativ hittades.</Notice>
          )}
    </>
  );
}
