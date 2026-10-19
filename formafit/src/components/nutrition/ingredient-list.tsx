"use client";
import { GripVertical, Trash2 } from "lucide-react";
import { UnitInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MediaThumb } from "@/components/shared/media-thumb";
import { formatNutrient, isValidQuantity, scaleNutrients, toPer100g } from "@/lib/nutrition/engine";
import type { FoodSummary } from "@/lib/types";

export interface DraftIngredient {
  key: string;
  food: FoodSummary;
  quantity: string;
}

/** Editable ingredient rows with live per-row energy. */
export function IngredientRows({
  items,
  onChange,
  onRemove,
  extraActions,
}: {
  items: DraftIngredient[];
  onChange: (key: string, quantity: string) => void;
  onRemove: (key: string) => void;
  extraActions?: (item: DraftIngredient) => React.ReactNode;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const q = Number(item.quantity.replace(",", "."));
        const valid = isValidQuantity(q);
        const kcal = valid ? scaleNutrients(toPer100g(item.food), q).kcal : null;
        return (
          <li key={item.key} className="flex items-center gap-2 rounded-2xl border bg-surface p-2">
            <GripVertical className="hidden size-4 text-muted-foreground/50 sm:block" aria-hidden />
            <MediaThumb src={item.food.imageUrl} alt="" kind="food" category={item.food.category} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.food.name}</span>
              <span className="block text-xs text-muted-foreground tabular">{kcal !== null ? `${formatNutrient(kcal, "kcal")} kcal` : "Ogiltig mängd"}</span>
            </span>
            <UnitInput
              unit="g"
              aria-label={`Mängd ${item.food.name}`}
              aria-invalid={!valid}
              className="w-28 shrink-0"
              value={item.quantity}
              onChange={(e) => onChange(item.key, e.target.value)}
            />
            {extraActions?.(item)}
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Ta bort ${item.food.name}`} onClick={() => onRemove(item.key)}>
              <Trash2 />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
