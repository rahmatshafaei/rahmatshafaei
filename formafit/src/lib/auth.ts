import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

export interface AuthContext {
  supabase: ServerSupabase;
  userId: string;
  email: string | null;
}

/** Verified identity for the current request (JWT validated by Supabase), or null. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  return { supabase, userId: sub, email: (data.claims.email as string | undefined) ?? null };
});

/** Use in pages and layouts: redirects to login when there is no session. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/logga-in");
  return auth;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Du måste vara inloggad.");
    this.name = "UnauthorizedError";
  }
}

/** Use in Server Actions and Route Handlers: throws instead of redirecting. */
export async function requireAuthForAction(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new UnauthorizedError();
  return auth;
}
