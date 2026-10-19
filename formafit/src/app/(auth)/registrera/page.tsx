import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "../auth-forms";

export const metadata: Metadata = { title: "Skapa konto" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Skapa ditt konto</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Det tar ungefär två minuter att komma igång.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Har du redan ett konto?{" "}
        <Link href="/logga-in" className="font-medium text-primary-strong hover:underline">
          Logga in
        </Link>
      </p>
    </>
  );
}
