import { cn } from "@/lib/utils";

/** FormaFit mark: a rising arc inside a rounded square – momentum and balance. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M9 22.5c2.2-6.6 6.6-10.4 14-11.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="10.5" cy="11" r="2.4" fill="#fff" />
      <path d="M15.5 22.5h7" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">
        Forma<span className="text-primary">Fit</span>
      </span>
    </span>
  );
}
