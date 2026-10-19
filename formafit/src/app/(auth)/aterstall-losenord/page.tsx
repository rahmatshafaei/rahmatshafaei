import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { ResetPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Nytt lösenord" };

export default async function ResetPasswordPage() {
  // The recovery link signs the user in with a short-lived session.
  await requireAuth();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Välj nytt lösenord</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Använd minst 8 tecken.</p>
      <ResetPasswordForm />
    </>
  );
}
