"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Apple, Bot, ChartLine, Dumbbell, House, LogOut, UserRound } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/hem", label: "Hem", icon: House },
  { href: "/mat", label: "Mat", icon: Apple },
  { href: "/traning", label: "Träning", icon: Dumbbell },
  { href: "/framsteg", label: "Framsteg", icon: ChartLine },
  { href: "/profil", label: "Profil", icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-surface/70 px-4 py-6 backdrop-blur lg:flex">
      <Link href="/hem" className="px-2">
        <Logo />
      </Link>
      <nav className="mt-8 flex flex-col gap-1" aria-label="Huvudmeny">
        {NAV.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground",
              isActive(pathname, href) && "bg-primary-soft text-primary-strong hover:bg-primary-soft hover:text-primary-strong",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
        <Link
          href="/coach"
          aria-current={isActive(pathname, "/coach") ? "page" : undefined}
          className={cn(
            "mt-3 flex items-center gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary-soft to-surface px-3 py-2.5 text-sm font-semibold text-primary-strong transition-colors hover:border-primary/50",
            isActive(pathname, "/coach") && "border-primary",
          )}
        >
          <Bot className="size-5" aria-hidden />
          AI-coach
        </Link>
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        <Link
          href="/profil"
          aria-current={isActive(pathname, "/profil") ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            isActive(pathname, "/profil") && "bg-primary-soft text-primary-strong",
          )}
        >
          <UserRound className="size-5" aria-hidden />
          Profil
        </Link>
        <form action="/auth/logout" method="post">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground">
            <LogOut className="size-5" aria-hidden />
            Logga ut
          </button>
        </form>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  // Hidden on the coach itself and during an active workout (where the rest timer sits).
  const onCoach = isActive(pathname, "/coach") || pathname.startsWith("/traning/pass/");
  return (
    <>
      {!onCoach ? (
        <Link
          href="/coach"
          className="no-print fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full bg-[#13261b] py-3 pr-4 pl-3.5 text-sm font-semibold text-white shadow-[var(--shadow-float)] lg:hidden"
        >
          <Bot className="size-5 text-[#7ee2a8]" aria-hidden />
          Coach
        </Link>
      ) : null}
      <nav
        aria-label="Huvudmeny"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-surface/95 pb-safe backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground",
                    active && "text-primary-strong",
                  )}
                >
                  <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary-soft")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Secondary tab bar used inside sections (Mat, Träning, Framsteg). */
export function SectionTabs({ tabs }: { tabs: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <div className="no-print -mx-4 mb-6 overflow-x-auto px-4 scrollbar-none">
      <div className="inline-flex gap-1 rounded-2xl bg-surface-muted p-1">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                active && "bg-surface text-foreground shadow-sm",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
