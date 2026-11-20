import Link from "next/link";
import { Apple, Bot, CalendarRange, ChartLine, Dumbbell, ShoppingBasket } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/nutrition/progress-ring";
import { MacroBar } from "@/components/nutrition/macro-bar";
import { Notice } from "@/components/ui/feedback";

const FEATURES = [
  { icon: Apple, title: "Kalorier och makron", text: "Logga mat i gram. Allt räknas från livsmedelsdata – aldrig gissat." },
  { icon: CalendarRange, title: "Måltidsplaner", text: "Bygg dag- och veckoplaner, flytta måltider och markera dem som ätna." },
  { icon: Dumbbell, title: "Träningsprogram", text: "PPL, över/under, helkropp eller egna upplägg med supersets och vila." },
  { icon: Bot, title: "AI-coach", text: "Få förslag på måltider, pass och byten som du själv granskar och godkänner." },
  { icon: ShoppingBasket, title: "Inköpslistor", text: "Samlade mängder per butiksavdelning, direkt från din plan." },
  { icon: ChartLine, title: "Framsteg", text: "Vikt, mått, styrka och följsamhet – baserat på det du faktiskt loggat." },
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ konto?: string }> }) {
  const { konto } = await searchParams;
  return (
    <div className="min-h-dvh">
      {konto === "raderat" ? (
        <div className="mx-auto max-w-6xl px-5 pt-4">
          <Notice title="Ditt konto är raderat">All din data har tagits bort. Tack för att du använde FormaFit.</Notice>
        </div>
      ) : null}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/logga-in">Logga in</Link>
          </Button>
          <Button asChild>
            <Link href="/registrera">Kom igång</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-10 pb-20 lg:grid-cols-2 lg:pt-16">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary-strong">
              Kost, träning och coachning – på svenska
            </p>
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
              Allt du behöver för att äta och träna med plan.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              FormaFit kopplar ihop din matdagbok, dina måltidsplaner och ditt träningsprogram så att varje steg bygger på
              riktiga data – från första passet till nästa personbästa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/registrera">Skapa gratis konto</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/logga-in">Jag har redan ett konto</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md" aria-label="Exempel på dagsöversikt" role="img">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(circle_at_30%_20%,var(--glow-green),transparent_60%),radial-gradient(circle_at_80%_80%,var(--glow-amber),transparent_55%)]" />
            <div className="rounded-3xl border bg-surface p-6 shadow-[var(--shadow-float)]">
              <p className="text-sm text-muted-foreground">Exempel · Idag</p>
              <div className="mt-4 flex items-center gap-6">
                <ProgressRing value={1460} max={2200} size={140} label="1460 av 2200 kcal">
                  <span className="text-2xl font-semibold tabular">740</span>
                  <span className="text-xs text-muted-foreground">kcal kvar</span>
                </ProgressRing>
                <div className="flex flex-1 flex-col gap-3">
                  <MacroBar macro="protein" value={112} target={160} compact />
                  <MacroBar macro="carbs" value={148} target={230} compact />
                  <MacroBar macro="fat" value={41} target={70} compact />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-surface-muted p-3">
                  <p className="text-muted-foreground">Nästa pass</p>
                  <p className="font-medium">Pull · 6 övningar</p>
                </div>
                <div className="rounded-2xl bg-surface-muted p-3">
                  <p className="text-muted-foreground">Veckosnitt vikt</p>
                  <p className="font-medium">−0,4 kg</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t bg-surface/60">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Sex verktyg som hänger ihop</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-3xl border bg-surface p-6 shadow-[var(--shadow-card)]">
                  <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} FormaFit</span>
        <span>
          Allmänna råd om kost och träning – inte medicinsk rådgivning. <Link href="/integritet" className="underline">Integritet</Link>
        </span>
      </footer>
    </div>
  );
}
