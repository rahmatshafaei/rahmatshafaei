import { ProgressRing } from "./progress-ring";
import { MacroBar } from "./macro-bar";
import { formatNutrient, type NutrientTotals } from "@/lib/nutrition/engine";
import { Notice } from "@/components/ui/feedback";

export function DaySummary({
  totals,
  targets,
}: {
  totals: NutrientTotals;
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
}) {
  const target = targets?.calories ?? 0;
  const remaining = target - totals.kcal;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <ProgressRing
          value={totals.kcal}
          max={target}
          label={`${formatNutrient(totals.kcal, "kcal")} av ${target} kcal`}
        >
          <span className="text-3xl font-semibold tabular">{formatNutrient(Math.abs(remaining), "kcal")}</span>
          <span className="text-xs text-muted-foreground">{remaining >= 0 ? "kcal kvar" : "kcal över"}</span>
        </ProgressRing>
        <div className="flex w-full flex-1 flex-col gap-3.5">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-muted-foreground">Mål</p>
              <p className="font-semibold tabular">{target.toLocaleString("sv-SE")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ätit</p>
              <p className="font-semibold tabular">{formatNutrient(totals.kcal, "kcal")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Kvar</p>
              <p className="font-semibold tabular">{formatNutrient(remaining, "kcal")}</p>
            </div>
          </div>
          <MacroBar macro="protein" value={totals.protein} target={targets?.protein_g ?? 0} />
          <MacroBar macro="carbs" value={totals.carbs} target={targets?.carbs_g ?? 0} />
          <MacroBar macro="fat" value={totals.fat} target={targets?.fat_g ?? 0} />
        </div>
      </div>
      {totals.missing.length ? (
        <Notice variant="warning">Vissa livsmedel saknar näringsvärden, så summan kan vara för låg.</Notice>
      ) : null}
    </div>
  );
}
