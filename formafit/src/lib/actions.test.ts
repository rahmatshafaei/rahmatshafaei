import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/auth", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireAuthForAction: vi.fn(async () => ({ supabase: {}, userId: "u1", email: null })),
}));

import { authedAction, databaseErrorMessage, toActionError, UserFacingError } from "./actions";

describe("action error handling", () => {
  it("maps database errors to safe Swedish messages", () => {
    expect(databaseErrorMessage({ code: "23505", message: "duplicate key value violates unique constraint \"workout_sessions_one_open_idx\"" })).toMatch(/pågående pass/);
    expect(databaseErrorMessage({ code: "42501", message: "permission denied" })).toMatch(/behörighet/);
    expect(databaseErrorMessage({ code: "XX000", message: "internal secret details" })).toBe("Något gick fel. Försök igen.");
  });

  it("returns field errors for validation failures", () => {
    const err = z.object({ quantity: z.number().positive("Mängden måste vara större än 0 g.") }).safeParse({ quantity: -1 }).error!;
    const res = toActionError(err);
    expect(res.fieldErrors).toEqual({ quantity: ["Mängden måste vara större än 0 g."] });
  });

  it("never leaks unexpected error details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await authedAction(async () => {
      throw new Error("connection string postgres://secret");
    });
    expect(res).toEqual({ ok: false, error: "Något gick fel. Försök igen." });
    const ok = await authedAction(async ({ userId }) => userId);
    expect(ok).toEqual({ ok: true, data: "u1" });
    const user = await authedAction(async () => {
      throw new UserFacingError("Synligt fel");
    });
    expect(user).toEqual({ ok: false, error: "Synligt fel" });
  });
});
