"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Single-choice cards rendered as an accessible radio group. */
export function OptionCards<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = 1,
  label,
}: {
  name: string;
  value: T | null;
  onChange: (value: T) => void;
  options: { value: T; label: string; description?: string; icon?: React.ReactNode }[];
  columns?: 1 | 2 | 3;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border bg-surface p-4 transition-colors hover:border-primary/40",
              selected && "border-primary bg-primary-soft/60 ring-1 ring-primary",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={selected}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.icon ? <span className="mt-0.5 text-primary-strong">{o.icon}</span> : null}
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{o.label}</span>
              {o.description ? <span className="mt-0.5 block text-sm text-muted-foreground">{o.description}</span> : null}
            </span>
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                selected && "border-primary-strong bg-primary-strong text-primary-foreground",
              )}
            >
              {selected ? <Check className="size-3.5" /> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Multi-select chips rendered as toggle buttons. */
export function ChipGroup<T extends string>({
  values,
  onChange,
  options,
  label,
}: {
  values: T[];
  onChange: (values: T[]) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? values.filter((v) => v !== o.value) : [...values, o.value])}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border bg-surface px-3.5 py-2 text-sm transition-colors hover:border-primary/40",
              selected && "border-primary bg-primary-soft text-primary-strong",
            )}
          >
            {selected ? <Check className="size-3.5" aria-hidden /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
