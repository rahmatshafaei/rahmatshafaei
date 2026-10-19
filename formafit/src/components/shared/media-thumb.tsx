import { Apple, Beef, Croissant, Dumbbell, Milk, Package, Salad, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS = {
  meat_fish: Beef,
  dairy: Milk,
  grains: Wheat,
  produce: Apple,
  pantry: Package,
  other: Croissant,
} as const;

/**
 * Shows a real image when one exists (user upload or licensed source such as Open Food
 * Facts). Otherwise renders a neutral illustration that is clearly not a photo, so an
 * unrelated picture is never associated with a food or exercise.
 */
export function MediaThumb({
  src,
  alt,
  kind,
  category,
  size = "md",
  className,
}: {
  src?: string | null;
  alt: string;
  kind: "food" | "exercise" | "meal";
  category?: keyof typeof CATEGORY_ICONS | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = { sm: "size-10 rounded-xl", md: "size-14 rounded-2xl", lg: "aspect-[4/3] w-full rounded-2xl" }[size];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs and external licensed images
      <img src={src} alt={alt} loading="lazy" className={cn(dims, "shrink-0 bg-surface-muted object-cover", className)} />
    );
  }
  const Icon = kind === "exercise" ? Dumbbell : kind === "meal" ? Salad : CATEGORY_ICONS[category ?? "other"];
  return (
    <div
      className={cn(dims, "flex shrink-0 items-center justify-center bg-gradient-to-br from-primary-soft to-[#f4efe4] text-primary-strong", className)}
      aria-hidden
    >
      <Icon className={size === "lg" ? "size-10 opacity-70" : "size-5 opacity-80"} />
    </div>
  );
}
