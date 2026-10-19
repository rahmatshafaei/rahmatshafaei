"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/feedback";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthFormState } from "./actions";

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className="pr-11" {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Dölj lösenord" : "Visa lösenord"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function FormStatus({ state }: { state: AuthFormState }) {
  if (state.error) return <Notice variant="danger">{state.error}</Notice>;
  if (state.message) return <Notice variant="info">{state.message}</Notice>;
  return null;
}

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {notice && !state.error ? <Notice variant="info">{notice}</Notice> : null}
      <FormStatus state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-post" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      </Field>
      <Field label="Lösenord" htmlFor="password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/glomt-losenord" className="text-sm text-primary-strong hover:underline">
          Glömt lösenordet?
        </Link>
      </div>
      <Button type="submit" size="lg" loading={pending}>
        Logga in
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUp, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} />
      <Field label="E-post" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      </Field>
      <Field label="Lösenord" htmlFor="password" hint="Minst 8 tecken.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} aria-describedby="password-hint" />
      </Field>
      <label className="flex items-start gap-3 text-sm text-muted-foreground">
        <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-[var(--primary)]" required />
        <span>
          Jag förstår att FormaFit ger allmänna råd och inte ersätter medicinsk rådgivning, och godkänner att mina uppgifter
          lagras enligt <Link href="/integritet" className="text-primary-strong underline">integritetspolicyn</Link>.
        </span>
      </label>
      <Button type="submit" size="lg" loading={pending}>
        Skapa konto
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} />
      <Field label="E-post" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        Skicka återställningslänk
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} />
      <Field label="Nytt lösenord" htmlFor="password" hint="Minst 8 tecken.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Upprepa lösenord" htmlFor="confirm">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        Spara nytt lösenord
      </Button>
    </form>
  );
}
