"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction, unwrap, UserFacingError } from "@/lib/actions";
import { isValidTimeZone, TEST_NOTIFICATION } from "@/lib/reminders";
import { configuredSender, deliverToUser } from "@/lib/services/push";

/** Base64url value that decodes to exactly `bytes` bytes. */
const base64urlBytes = (bytes: number) =>
  z
    .string()
    .max(200)
    .regex(/^[A-Za-z0-9_-]+={0,2}$/)
    .refine((v) => Buffer.from(v, "base64url").length === bytes, "Ogiltig prenumeration.");

const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/, message: "Ogiltig prenumeration." }).max(2048),
  keys: z.object({
    // Uncompressed P-256 public key and the 16-byte auth secret (RFC 8291).
    p256dh: base64urlBytes(65),
    auth: base64urlBytes(16),
  }),
  userAgent: z.string().max(300).optional(),
});

/** Saves this browser's push subscription for the signed-in user. */
export async function registerPushSubscription(raw: unknown) {
  return authedAction(async ({ supabase }) => {
    const input = subscriptionSchema.parse(raw);
    unwrap(
      await supabase.rpc("register_push_subscription", {
        p_endpoint: input.endpoint,
        p_p256dh: input.keys.p256dh,
        p_auth: input.keys.auth,
        p_user_agent: input.userAgent,
      }),
    );
    return null;
  });
}

export async function unregisterPushSubscription(rawEndpoint: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const endpoint = z.string().max(2048).parse(rawEndpoint);
    unwrap(await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint));
    return null;
  });
}

/** Whether this browser's subscription belongs to the signed-in user, and how many devices they have. */
export async function pushDeviceStatus(rawEndpoint: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const endpoint = z.string().max(2048).nullable().parse(rawEndpoint);
    const rows = unwrap(await supabase.from("push_subscriptions").select("endpoint").eq("user_id", userId));
    return { registered: endpoint !== null && rows.some((r) => r.endpoint === endpoint), devices: rows.length };
  });
}

export async function removeAllPushSubscriptions() {
  return authedAction(async ({ supabase, userId }) => {
    unwrap(await supabase.from("push_subscriptions").delete().eq("user_id", userId));
    return null;
  });
}

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ange en tid som tt:mm.")
  .nullable();

const reminderSettingsSchema = z.object({
  timezone: z.string().max(64).refine(isValidTimeZone, "Okänd tidszon."),
  workoutTime: time,
  mealTime: time,
});

export async function saveReminderSettings(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = reminderSettingsSchema.parse(raw);
    unwrap(
      await supabase
        .from("user_preferences")
        .update({ reminder_timezone: input.timezone, workout_reminder_time: input.workoutTime, meal_reminder_time: input.mealTime })
        .eq("user_id", userId),
    );
    revalidatePath("/profil");
    return null;
  });
}

/** Sends a test notification to the user's own devices. */
export async function sendTestNotification() {
  return authedAction(async ({ supabase, userId }) => {
    const send = configuredSender();
    if (!send) throw new UserFacingError("Notiser är inte konfigurerade på servern.");
    const result = await deliverToUser(supabase, userId, TEST_NOTIFICATION, send);
    if (result.sent === 0) throw new UserFacingError("Ingen enhet tog emot notisen. Aktivera notiser igen på den här enheten.");
    return { sent: result.sent };
  });
}
