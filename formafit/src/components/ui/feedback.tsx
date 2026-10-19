import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-surface-muted", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-[var(--radius)] border border-dashed bg-surface/60 px-6 py-10 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Notice({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: "info" | "warning" | "danger";
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: "bg-info-soft text-[#1f4fa3] border-[#cfdcf5]",
    warning: "bg-warning-soft text-[#7a5212] border-[#f3dfb5]",
    danger: "bg-danger-soft text-[#8f2727] border-[#f1c9c9]",
  }[variant];
  const Icon = variant === "info" ? Info : AlertTriangle;
  return (
    <div role={variant === "danger" ? "alert" : "note"} className={cn("flex gap-3 rounded-2xl border p-3.5 text-sm", styles, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={cn(title && "mt-0.5", "[&_a]:underline")}>{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-sm text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
