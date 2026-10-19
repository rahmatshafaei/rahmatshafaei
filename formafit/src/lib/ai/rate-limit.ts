import "server-only";
import { UserFacingError, unwrap } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export type AiKind = "coach" | "meal_plan" | "meal_regenerate" | "workout_plan" | "substitution";

/** Per-user hourly quota backed by the append-only ai_request_log table. */
export async function consumeAiQuota(auth: AuthContext, kind: AiKind) {
  const env = serverEnv();
  const limit = kind === "coach" ? env.AI_COACH_HOURLY_LIMIT : kind === "substitution" ? env.AI_GENERATION_HOURLY_LIMIT * 3 : env.AI_GENERATION_HOURLY_LIMIT;
  const allowed = unwrap(await auth.supabase.rpc("consume_ai_quota", { p_kind: kind, p_limit: limit, p_window_minutes: 60 }));
  if (!allowed) {
    throw new UserFacingError("Du har nått gränsen för AI-förfrågningar den här timmen. Försök igen senare.");
  }
}
