import "server-only";
import { z } from "zod";
import { requireAuthForAction, UnauthorizedError, type AuthContext } from "@/lib/auth";
import { NutritionInputError } from "@/lib/nutrition/engine";
import { SetValidationError } from "@/lib/workout/logic";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Errors whose message is safe to show to the user. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

function isPostgrestError(e: unknown): e is PostgrestLikeError {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

/** Maps database errors to Swedish messages without exposing internals. */
export function databaseErrorMessage(e: PostgrestLikeError): string {
  switch (e.code) {
    case "23505":
      return e.message?.includes("open workout session") || e.message?.includes("workout_sessions_one_open")
        ? "Du har redan ett pågående pass. Avsluta det först."
        : "Det finns redan en post med samma värden.";
    case "23503":
      return "Posten används av annan data och kan inte tas bort, eller hänvisar till något som saknas.";
    case "23514":
    case "22023":
    case "22P02":
      return e.message?.includes("no completed sets")
        ? "Logga minst ett genomfört set innan du avslutar passet."
        : "Ogiltiga värden – kontrollera formuläret.";
    case "42501":
      return "Du har inte behörighet till den här posten.";
    case "P0002":
    case "PGRST116":
      return "Posten hittades inte.";
    case "28000":
      return "Du måste vara inloggad.";
    default:
      return "Något gick fel. Försök igen.";
  }
}

export function toActionError(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string[]> } {
  if (e instanceof z.ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of e.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: e.issues[0]?.message ?? "Ogiltiga värden.", fieldErrors };
  }
  if (e instanceof UnauthorizedError || e instanceof UserFacingError || e instanceof NutritionInputError || e instanceof SetValidationError) {
    return { ok: false, error: e.message };
  }
  if (isPostgrestError(e)) {
    console.error("[db]", e.code, e.message);
    return { ok: false, error: databaseErrorMessage(e) };
  }
  console.error("[action]", e);
  return { ok: false, error: "Något gick fel. Försök igen." };
}

/** Runs an authenticated server action body and converts thrown errors into results. */
export async function authedAction<T>(fn: (auth: AuthContext) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const auth = await requireAuthForAction();
    const data = await fn(auth);
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Throws the Supabase error (if any) so authedAction can map it. Returns the data typed as
 * non-null: queries with `.select()`/`.single()` always return data when there is no error.
 * For writes without `.select()` the return value is meaningless and should be ignored.
 */
export function unwrap<T>(result: { data: T; error: PostgrestLikeError | null }): NonNullable<T> {
  if (result.error) throw result.error;
  return result.data as NonNullable<T>;
}
