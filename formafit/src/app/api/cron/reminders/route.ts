import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cronSecret } from "@/lib/env";
import { configuredSender, runReminderJob } from "@/lib/services/push";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorised(header: string | null, secret: string) {
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));
}

/**
 * Sends due reminders. Call it every 5–60 minutes from a scheduler (Vercel Cron, Supabase
 * pg_cron + pg_net, GitHub Actions, …) with `Authorization: Bearer <CRON_SECRET>`.
 * The response contains counts only, never personal data.
 */
async function handle(request: NextRequest) {
  const secret = cronSecret();
  if (!secret || !authorised(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const send = configuredSender();
  if (!admin || !send) {
    return NextResponse.json({ error: "Påminnelser är inte konfigurerade (VAPID-nycklar eller service role saknas)." }, { status: 503 });
  }
  try {
    return NextResponse.json(await runReminderJob(admin, send));
  } catch (e) {
    console.error("[cron:reminders]", e);
    return NextResponse.json({ error: "Påminnelsejobbet misslyckades." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
