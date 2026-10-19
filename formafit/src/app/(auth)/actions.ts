"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export interface AuthFormState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  email?: string;
}

const email = z.email({ message: "Ange en giltig e-postadress." }).max(254);
const password = z
  .string()
  .min(8, "Lösenordet måste vara minst 8 tecken.")
  .max(72, "Lösenordet får vara högst 72 tecken.");

/** Only allow relative in-app redirects to prevent open redirects. */
function safeNext(value: FormDataEntryValue | null, fallback: string) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

function authErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case "invalid_credentials":
      return "Fel e-postadress eller lösenord.";
    case "email_not_confirmed":
      return "Bekräfta din e-postadress via länken vi skickade innan du loggar in.";
    case "user_already_exists":
    case "email_exists":
      return "Det finns redan ett konto med den e-postadressen.";
    case "weak_password":
      return "Lösenordet är för svagt. Välj ett längre lösenord.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "För många försök. Vänta en stund och försök igen.";
    case "same_password":
      return "Välj ett annat lösenord än ditt nuvarande.";
    default:
      return fallback;
  }
}

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({ email, password: z.string().min(1, "Ange ditt lösenord.") }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const typedEmail = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email: typedEmail };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: authErrorMessage(error.code, "Inloggningen misslyckades. Försök igen."), email: typedEmail };
  }
  redirect(safeNext(formData.get("next"), "/hem"));
}

export async function signUp(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ email, password, terms: z.literal("on", { message: "Du behöver godkänna villkoren." }) })
    .safeParse({ email: formData.get("email"), password: formData.get("password"), terms: formData.get("terms") });
  const typedEmail = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email: typedEmail };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding` },
  });
  if (error) {
    return { error: authErrorMessage(error.code, "Registreringen misslyckades. Försök igen."), email: typedEmail };
  }
  if (!data.session) {
    return {
      message: "Nästan klart! Vi har skickat en bekräftelselänk till din e-post. Öppna den för att aktivera kontot.",
      email: typedEmail,
    };
  }
  redirect("/onboarding");
}

export async function requestPasswordReset(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/aterstall-losenord`,
  });
  if (error && error.code?.startsWith("over_")) {
    return { error: authErrorMessage(error.code, "") };
  }
  // Same response whether or not the account exists (prevents account enumeration).
  return { message: "Om det finns ett konto för adressen har vi skickat en länk för att välja nytt lösenord." };
}

export async function updatePassword(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Lösenorden matchar inte.", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error.code, "Det gick inte att byta lösenord. Begär en ny länk.") };
  redirect("/hem?losenord=uppdaterat");
}
