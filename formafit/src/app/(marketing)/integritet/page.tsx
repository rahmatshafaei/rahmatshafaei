import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "Integritet" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/">
        <Logo />
      </Link>
      <h1 className="mt-10 text-3xl font-semibold tracking-tight">Integritet och data</h1>
      <div className="mt-6 space-y-4 text-muted-foreground [&_h2]:mt-8 [&_h2]:font-semibold [&_h2]:text-foreground">
        <p>FormaFit lagrar bara det som behövs för att appen ska fungera. Här är en kort sammanfattning.</p>
        <h2>Vad vi lagrar</h2>
        <p>
          Kontouppgifter (e-post), profiluppgifter du anger vid start, din matdagbok, planer, träningsloggar, mått och
          eventuella framstegsbilder. Alla privata poster är kopplade till ditt konto och skyddas av radnivåsäkerhet i
          databasen så att ingen annan användare kan läsa dem.
        </p>
        <h2>Framstegsbilder</h2>
        <p>Bilder lagras i en privat lagringsyta och visas endast via tidsbegränsade länkar för dig.</p>
        <h2>AI-coachen</h2>
        <p>
          När du använder AI-funktionerna skickas endast den information som behövs för frågan (t.ex. dina mål och en
          sammanfattning av relevanta loggar) till AI-leverantören. Du kan stänga av delning av loggar under Profil.
        </p>
        <h2>Medicinsk information</h2>
        <p>
          FormaFit ger allmänna råd om kost och träning och är inte en medicinsk tjänst. Kontakta vården vid sjukdom,
          ätstörningsproblematik, graviditet eller andra medicinska frågor.
        </p>
      </div>
    </div>
  );
}
