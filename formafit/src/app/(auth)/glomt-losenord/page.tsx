import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Glömt lösenord" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Glömt lösenordet?</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Ange din e-post så skickar vi en länk för att välja ett nytt.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/logga-in" className="text-primary-strong hover:underline">
          Tillbaka till inloggning
        </Link>
      </p>
    </>
  );
}
