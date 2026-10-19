import { formatNutrient } from "@/lib/nutrition/engine";
import { cn } from "@/lib/utils";

export const MACRO_META = {
  protein: { label: "Protein", color: "var(--macro-protein)", dot: "bg-macro-protein" },
  carbs: { label: "Kolhydrater", color: "var(--macro-carbs)", dot: "bg-macro-carbs" },
  fat: { label: "Fett", color: "var(--macro-fat)", dot: "bg-macro-fat" },
} as const;

export function MacroBar({
  macro,
  value,
  target,
  compact,
}: {
  macro: keyof typeof MACRO_META;
  value: number;
  target: number;
  compact?: boolean;
}) {
  const meta = MACRO_META[macro];
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden />
          {meta.label}
        </span>
        <span className="tabular whitespace-nowrap text-muted-foreground">
          <span className="font-semibold text-foreground">{formatNutrient(value, macro)}</span> / {Math.round(target)} g
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-label={meta.label}
        aria-valuemin={0}
        aria-valuemax={Math.round(target)}
        aria-valuenow={Math.round(value)}
      >
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: meta.color }} />
      </div>
    </div>
  );
}

/** Inline "123 kcal · P 30 g · K 12 g · F 4 g" line. */
export function MacroLine({
  totals,
  className,
}: {
  totals: { kcal: number; protein: number; carbs: number; fat: number; missing?: readonly string[] };
  className?: string;
}) {
  const incomplete = (totals.missing?.length ?? 0) > 0;
  return (
    <span className={cn("tabular text-sm text-muted-foreground", className)}>
      <span className="font-medium text-foreground">{formatNutrient(totals.kcal, "kcal")} kcal</span>
      {" · "}P {formatNutrient(totals.protein, "protein")} g · K {formatNutrient(totals.carbs, "carbs")} g · F{" "}
      {formatNutrient(totals.fat, "fat")} g
      {incomplete ? (
        <span className="ml-1 text-warning" title="Vissa näringsvärden saknas för minst ett livsmedel">
          (ofullständig)
        </span>
      ) : null}
    </span>
  );
}
