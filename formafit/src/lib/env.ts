import { z } from "zod";

/**
 * Environment validation. Public variables are inlined at build time by Next.js and must be
 * referenced explicitly. Server-only secrets are read through `serverEnv()` which must
 * never be imported into client components.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL måste vara en URL" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY saknas"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cachedPublic: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      `Ogiltig miljökonfiguration: ${parsed.error.issues.map((i) => i.message).join(", ")}. Se .env.example.`,
    );
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}

const serverSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-opus-5-5"),
  OPENFOODFACTS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  OPENFOODFACTS_USER_AGENT: z.string().default("FormaFit/1.0 (kontakt saknas)"),
  AI_COACH_HOURLY_LIMIT: z.coerce.number().int().positive().default(30),
  AI_GENERATION_HOURLY_LIMIT: z.coerce.number().int().positive().default(10),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() får bara anropas på servern.");
  }
  const parsed = serverSchema.safeParse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || undefined,
    OPENFOODFACTS_ENABLED: process.env.OPENFOODFACTS_ENABLED || undefined,
    OPENFOODFACTS_USER_AGENT: process.env.OPENFOODFACTS_USER_AGENT || undefined,
    AI_COACH_HOURLY_LIMIT: process.env.AI_COACH_HOURLY_LIMIT || undefined,
    AI_GENERATION_HOURLY_LIMIT: process.env.AI_GENERATION_HOURLY_LIMIT || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Ogiltig serverkonfiguration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const pushSchema = z.object({
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/, "NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
  VAPID_PRIVATE_KEY: z.string().regex(/^[A-Za-z0-9_-]{40,50}$/, "VAPID_PRIVATE_KEY"),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)\S+$/, "VAPID_SUBJECT"),
});

export type PushEnv = z.infer<typeof pushSchema>;

/**
 * Web Push (VAPID) keys, or null when push reminders are not configured. Generate keys with
 * `npx web-push generate-vapid-keys`. Server-only: the private key must never reach the client.
 */
export function pushEnv(): PushEnv | null {
  if (typeof window !== "undefined") throw new Error("pushEnv() får bara anropas på servern.");
  const raw = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  };
  if (!raw.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !raw.VAPID_PRIVATE_KEY) return null;
  const parsed = pushSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[push] Ogiltig konfiguration: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
    return null;
  }
  return parsed.data;
}

/** Shared secret that authorises the reminder job (`Authorization: Bearer <CRON_SECRET>`). */
export function cronSecret(): string | null {
  const s = process.env.CRON_SECRET;
  return s && s.length >= 32 ? s : null;
}
