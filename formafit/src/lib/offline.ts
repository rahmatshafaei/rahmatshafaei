import type { ActionResult } from "@/lib/actions";

export const OFFLINE_MESSAGE = "Ingen uppkoppling. Försök igen när du är online.";

/** True when a call failed before reaching the server (offline, DNS, dropped connection). */
export function isNetworkFailure(e: unknown): boolean {
  return e instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
}

/**
 * Calls a Server Action from the browser. A request that fails in transport rejects instead
 * of returning a result; that is reported as a normal error result.
 */
export async function callAction<T>(call: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await call();
  } catch (e) {
    return { ok: false, error: isNetworkFailure(e) ? OFFLINE_MESSAGE : "Något gick fel. Ladda om sidan och försök igen." };
  }
}
