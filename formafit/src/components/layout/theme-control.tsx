"use client";
import { useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useLocalStorage } from "@/lib/hooks";
import { THEME_KEY, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Ljust", icon: Sun },
  { value: "dark", label: "Mörkt", icon: Moon },
];

export function ThemeControl() {
  const [stored, setStored] = useLocalStorage(THEME_KEY);
  const theme: ThemePreference = stored === "light" || stored === "dark" ? stored : "system";

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Tema</span>
      <div role="group" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => setStored(value === "system" ? null : value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm text-muted-foreground transition-colors",
              theme === value && "bg-surface text-foreground shadow-sm",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
