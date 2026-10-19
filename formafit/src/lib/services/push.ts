import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrap } from "@/lib/actions";
import { pushEnv, pushTestHosts, type PushEnv } from "@/lib/env";
import { isAllowedPushEndpoint } from "@/lib/push-endpoints";
import { reminderMessage, type PushPayload, type ReminderCandidate } from "@/lib/reminders";
import type { Database } from "@/lib/supabase/database.types";

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Delivers one encrypted message. Rejects with `{ statusCode }` when the push service refuses it. */
export type PushSender = (target: PushTarget, payload: string) => Promise<void>;

/** Reminders are useless after a few hours, so the push service may drop them after that. */
const TTL_SECONDS = 3 * 60 * 60;

/** Sends with web-push, but only to known push services (a disallowed endpoint counts as gone). */
export function webPushSender(env: PushEnv, extraHosts: readonly string[] = []): PushSender {
  const options: webpush.RequestOptions = {
    vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
    TTL: TTL_SECONDS,
    urgency: "normal",
    timeout: 10_000,
  };
  return async (target, payload) => {
    if (!isAllowedPushEndpoint(target.endpoint, extraHosts)) {
      throw Object.assign(new Error("Push endpoint is not a known push service"), { statusCode: 410 });
    }
    await webpush.sendNotification(target, payload, options);
  };
}

/** A configured sender, or null when VAPID keys are missing. */
export function configuredSender(): PushSender | null {
  const env = pushEnv();
  return env ? webPushSender(env, pushTestHosts()) : null;
}

function statusOf(e: unknown): number | undefined {
  return typeof e === "object" && e !== null && "statusCode" in e ? Number((e as { statusCode: unknown }).statusCode) : undefined;
}

export interface DeliveryResult {
  sent: number;
  /** Subscriptions that accepted the message. */
  deliveredIds: string[];
  /** Subscriptions the push service reported as gone (404/410); they are deleted. */
  removed: number;
  failed: number;
}

/**
 * Sends a payload to every subscription of one user. Works with the user's own RLS-bound client
 * (test notification) or the service-role client (reminder job).
 */
export async function deliverToUser(
  db: SupabaseClient<Database>,
  userId: string,
  payload: PushPayload,
  send: PushSender,
): Promise<DeliveryResult> {
  const subs = unwrap(await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId));
  const body = JSON.stringify(payload);
  const result: DeliveryResult = { sent: 0, deliveredIds: [], removed: 0, failed: 0 };
  for (const sub of subs) {
    try {
      await send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      result.sent++;
      result.deliveredIds.push(sub.id);
    } catch (e) {
      const status = statusOf(e);
      if (status === 404 || status === 410) {
        await db.from("push_subscriptions").delete().eq("id", sub.id).eq("user_id", userId);
        result.removed++;
      } else {
        result.failed++;
        console.error("[push] delivery failed", status ?? (e as Error).message);
      }
    }
  }
  return result;
}

export interface ReminderJobResult {
  due: number;
  notified: number;
  skipped: number;
  sent: number;
  removed: number;
  failed: number;
}

/**
 * Sends all reminders that are due at `now`. Safe to run often and concurrently: each reminder
 * is claimed in the delivery log before it is sent, and the claim is released again only when
 * every delivery failed for a reason that may be temporary.
 */
export async function runReminderJob(admin: SupabaseClient<Database>, send: PushSender, now = new Date()): Promise<ReminderJobResult> {
  const due: ReminderCandidate[] = unwrap(await admin.rpc("reminder_candidates", { p_now: now.toISOString() }));
  const total: ReminderJobResult = { due: due.length, notified: 0, skipped: 0, sent: 0, removed: 0, failed: 0 };
  for (const c of due) {
    const payload = reminderMessage(c);
    if (!payload) continue;
    const claim = { user_id: c.user_id, kind: c.kind, local_date: c.local_date };
    const claimed = unwrap(
      await admin
        .from("notification_deliveries")
        .upsert(claim, { onConflict: "user_id,kind,local_date", ignoreDuplicates: true })
        .select("user_id"),
    );
    if (claimed.length === 0) {
      total.skipped++;
      continue;
    }
    const r = await deliverToUser(admin, c.user_id, payload, send);
    total.sent += r.sent;
    total.removed += r.removed;
    total.failed += r.failed;
    if (r.sent > 0) {
      total.notified++;
      await admin.from("push_subscriptions").update({ last_success_at: now.toISOString() }).in("id", r.deliveredIds);
    } else if (r.failed > 0) {
      await admin.from("notification_deliveries").delete().match(claim);
    }
  }
  return total;
}
