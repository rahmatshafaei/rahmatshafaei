import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { UserFacingError } from "@/lib/actions";
import { serverEnv } from "@/lib/env";

/** Server-side fallback when the model declines for policy reasons (routes by refusal category). */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  const env = serverEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new UserFacingError("AI-funktionerna är inte konfigurerade. Ange ANTHROPIC_API_KEY på servern.");
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 180_000 });
  return client;
}

export function aiModel() {
  return serverEnv().ANTHROPIC_MODEL;
}

/** Converts SDK errors to safe Swedish messages. Existing user data is never touched on failure. */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof UserFacingError) return e.message;
  if (e instanceof Anthropic.RateLimitError) return "AI-tjänsten är hårt belastad just nu. Vänta en stund och försök igen.";
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return "AI-tjänsten är felkonfigurerad (ogiltig API-nyckel).";
  }
  if (e instanceof Anthropic.BadRequestError) return "AI-tjänsten kunde inte behandla förfrågan.";
  if (e instanceof Anthropic.APIConnectionError) return "Det gick inte att nå AI-tjänsten. Kontrollera anslutningen och försök igen.";
  if (e instanceof Anthropic.APIError) return "AI-tjänsten svarar inte just nu. Försök igen om en stund.";
  return "AI-förslaget kunde inte skapas. Försök igen.";
}

export class AiResponseError extends UserFacingError {}

interface StructuredOptions<S extends z.ZodType> {
  schema: S;
  system: string;
  prompt: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

/**
 * Requests a structured (JSON-schema constrained) response and returns the parsed object.
 * Callers must still validate business rules (IDs, ranges) – the schema only guarantees shape.
 */
export async function generateStructured<S extends z.ZodType>({ schema, system, prompt, effort = "medium", maxTokens = 32000 }: StructuredOptions<S>): Promise<z.infer<S>> {
  const anthropic = getAnthropic();
  try {
    const stream = anthropic.beta.messages.stream({
      model: aiModel(),
      max_tokens: maxTokens,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: betaZodOutputFormat(schema), effort },
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      throw new AiResponseError("AI:n kunde inte skapa ett förslag för den här förfrågan.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new AiResponseError("Förslaget blev för långt. Prova färre dagar eller måltider.");
    }
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new AiResponseError("AI:n gav ett svar i fel format. Försök igen.");
    return parsed.data;
  } catch (e) {
    if (e instanceof UserFacingError) throw e;
    if (e instanceof SyntaxError) throw new AiResponseError("AI:n gav ett ofullständigt svar. Försök igen.");
    console.error("[ai] structured request failed", e instanceof Error ? e.message : e);
    throw new UserFacingError(aiErrorMessage(e));
  }
}
