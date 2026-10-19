import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Logga in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const notice = params.utloggad
    ? "Du är utloggad."
    : params.fel
      ? "Länken är ogiltig eller har gått ut. Försök igen."
      : undefined;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Välkommen tillbaka</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Logga in för att fortsätta där du slutade.</p>
      <LoginForm next={params.next} notice={notice} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ny här?{" "}
        <Link href="/registrera" className="font-medium text-primary-strong hover:underline">
          Skapa ett konto
        </Link>
      </p>
    </>
  );
}
