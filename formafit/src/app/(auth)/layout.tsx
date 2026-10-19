import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/shared/logo";

const POINTS = [
  "Kalorier och makron som räknas exakt från livsmedelsdata",
  "Måltidsplaner, recept och automatiska inköpslistor",
  "Träningsprogram, aktiva pass och progressionsförslag",
  "En AI-coach som utgår från dina egna loggar",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#13261b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute -top-32 -right-24 size-[28rem] rounded-full bg-[radial-gradient(circle,rgba(24,160,88,0.55),transparent_65%)]"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-20 size-[26rem] rounded-full bg-[radial-gradient(circle,rgba(233,162,59,0.25),transparent_65%)]"
        />
        <Link href="/" className="relative">
          <Logo className="text-white [&_span_span]:text-[#7ee2a8]" />
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">Form som håller. Steg för steg.</h2>
          <ul className="mt-8 space-y-3 text-white/85">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#7ee2a8]" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">
          FormaFit ger allmänna råd om kost och träning och ersätter inte vård eller medicinsk rådgivning.
        </p>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="mb-10 lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-10">{children}</div>
      </main>
    </div>
  );
}
