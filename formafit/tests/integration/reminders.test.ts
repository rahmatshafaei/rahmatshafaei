/**
 * Push reminders against the real database: RLS on subscriptions and the delivery log, and the
 * reminder job end to end with a fake push transport (the encryption is web-push's job).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { runReminderJob, type PushSender } from "@/lib/services/push";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "Integration-Test-123";

type Client = SupabaseClient<Database>;

async function newUser() {
  const client: Client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email: `rem-${crypto.randomUUID()}@example.com`, password: PASSWORD });
  if (error || !data.user) throw error ?? new Error("signUp failed");
  return { client, id: data.user.id };
}

const endpoint = (tag: string) => `https://push.example.test/${tag}/${crypto.randomUUID()}`;
const P256DH = "BElzYXRlc3RrZXlmb3JpbnRlZ3JhdGlvbnRlc3Rz";
const AUTH = "dGVzdGF1dGhzZWNyZXQ";

async function subscribe(c: Client, ep: string) {
  const { error } = await c.rpc("register_push_subscription", { p_endpoint: ep, p_p256dh: P256DH, p_auth: AUTH });
  expect(error).toBeNull();
}

describe("push subscriptions (RLS)", () => {
  it("can only be created through the registration function and are private", async () => {
    const [a, b] = await Promise.all([newUser(), newUser()]);
    const direct = await a.client.from("push_subscriptions").insert({ user_id: a.id, endpoint: endpoint("x"), p256dh: P256DH, auth: AUTH });
    expect(direct.error).not.toBeNull();

    const ep = endpoint("shared");
    await subscribe(a.client, ep);
    expect((await a.client.from("push_subscriptions").select("endpoint")).data).toEqual([{ endpoint: ep }]);
    expect((await b.client.from("push_subscriptions").select("endpoint")).data).toEqual([]);

    // B cannot delete A's subscription.
    await b.client.from("push_subscriptions").delete().eq("endpoint", ep);
    expect((await a.client.from("push_subscriptions").select("endpoint")).data).toHaveLength(1);

    // The same browser registered by B (shared device) moves to B; A stops receiving there.
    await subscribe(b.client, ep);
    expect((await a.client.from("push_subscriptions").select("endpoint")).data).toEqual([]);
    expect((await b.client.from("push_subscriptions").select("endpoint")).data).toEqual([{ endpoint: ep }]);
  });

  it("rejects non-https endpoints and keeps at most 10 devices per user", async () => {
    const a = await newUser();
    const bad = await a.client.rpc("register_push_subscription", { p_endpoint: "http://push.example.test/x", p_p256dh: P256DH, p_auth: AUTH });
    expect(bad.error).not.toBeNull();
    for (let i = 0; i < 12; i++) await subscribe(a.client, endpoint(`dev${i}`));
    expect((await a.client.from("push_subscriptions").select("id")).data).toHaveLength(10);
  });

  it("limits test notifications to 5 per hour", async () => {
    const a = await newUser();
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await a.client.rpc("claim_push_test")).data);
    expect(results).toEqual([true, true, true, true, true, false]);
    // The log cannot be read or cleared directly.
    expect((await a.client.from("push_test_log").select("id")).data).toEqual([]);
    await a.client.from("push_test_log").delete().eq("user_id", a.id);
    expect((await a.client.rpc("claim_push_test")).data).toBe(false);
  });

  it("keeps the delivery log and due reminders away from users", async () => {
    const a = await newUser();
    const insert = await a.client.from("notification_deliveries").insert({ user_id: a.id, kind: "workout", local_date: "2026-10-21" });
    expect(insert.error).not.toBeNull();
    const rpc = await a.client.rpc("reminder_candidates", { p_now: new Date().toISOString() });
    expect(rpc.error).not.toBeNull();
  });
});

describe.skipIf(!serviceKey)("reminder job", () => {
  // Wednesday 21 October 2026, 18:30 in Stockholm (UTC+2) and 12:30 in New York (UTC-4).
  const NOW = new Date("2026-10-21T16:30:00.000Z");
  const admin = createClient<Database>(url, serviceKey ?? "", { auth: { persistSession: false } });

  async function withProgram(c: Client, weekday: number) {
    const { data: programId, error } = await c.rpc("create_workout_program", {
      p_program: { name: "Program", days: [{ name: "Vila", weekday, is_rest_day: true }, { name: "Push A", weekday }] },
    });
    expect(error).toBeNull();
    expect((await c.rpc("set_active_program", { p_program_id: programId! })).error).toBeNull();
  }

  async function settings(c: Client, userId: string, s: { tz?: string; workout?: string | null; meal?: string | null }) {
    const { error } = await c
      .from("user_preferences")
      .update({ reminder_timezone: s.tz ?? "Europe/Stockholm", workout_reminder_time: s.workout ?? null, meal_reminder_time: s.meal ?? null })
      .eq("user_id", userId);
    expect(error).toBeNull();
  }

  it("sends only reminders supported by the data, once per day", async () => {
    const [due, trained, later, gone, flaky, newYork, badTz] = await Promise.all(Array.from({ length: 7 }, newUser));

    // Planned day today, nothing logged: both reminders.
    await withProgram(due.client, 3);
    await settings(due.client, due.id, { workout: "18:00", meal: "18:15" });
    const dueEp = endpoint("due");
    await subscribe(due.client, dueEp);

    // Already started a session and logged food today: nothing.
    await withProgram(trained.client, 3);
    await settings(trained.client, trained.id, { workout: "18:00", meal: "18:00" });
    expect((await trained.client.from("workout_sessions").insert({ user_id: trained.id, name: "Tidigare", status: "abandoned", started_at: "2026-10-21T15:00:00Z" })).error).toBeNull();
    expect(
      (await trained.client.from("diary_entries").insert({ user_id: trained.id, entry_date: "2026-10-21", meal_slot: "lunch", food_name: "Ägg", quantity_g: 100, verification: "user_entered" })).error,
    ).toBeNull();
    const trainedEp = endpoint("trained");
    await subscribe(trained.client, trainedEp);

    // Reminder time not reached yet, and no training planned on Wednesdays.
    await withProgram(later.client, 4);
    await settings(later.client, later.id, { workout: "18:00", meal: "21:00" });
    const laterEp = endpoint("later");
    await subscribe(later.client, laterEp);

    // The push service says the subscription is gone: it is deleted.
    await settings(gone.client, gone.id, { meal: "18:00" });
    const goneEp = endpoint("gone");
    await subscribe(gone.client, goneEp);

    // A temporary failure releases the claim so the next run retries.
    await settings(flaky.client, flaky.id, { meal: "18:00" });
    const flakyEp = endpoint("flaky");
    await subscribe(flaky.client, flakyEp);

    // Local time in another time zone (12:30 on the same date).
    await settings(newYork.client, newYork.id, { tz: "America/New_York", meal: "12:00" });
    const nyEp = endpoint("newyork");
    await subscribe(newYork.client, nyEp);

    // An invalid time zone (bypassing app validation) is skipped without breaking the job.
    expect((await admin.from("user_preferences").update({ reminder_timezone: "Mars/Olympus", meal_reminder_time: "00:00" }).eq("user_id", badTz.id)).error).toBeNull();
    const badEp = endpoint("badtz");
    await subscribe(badTz.client, badEp);

    const calls: { endpoint: string; payload: { title: string; body: string; url: string; tag: string } }[] = [];
    const send: PushSender = async (target, payload) => {
      calls.push({ endpoint: target.endpoint, payload: JSON.parse(payload) });
      if (target.endpoint.includes("/gone/")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      if (target.endpoint.includes("/flaky/")) throw Object.assign(new Error("Unavailable"), { statusCode: 503 });
    };

    await runReminderJob(admin, send, NOW);
    const to = (ep: string) => calls.filter((c) => c.endpoint === ep).map((c) => c.payload);

    expect(to(dueEp)).toEqual(
      expect.arrayContaining([
        { title: "Dags att träna", body: "I dag står Push A på schemat i ditt program.", url: "/traning", tag: "workout-2026-10-21" },
        { title: "Glöm inte att logga", body: "Du har inte loggat några måltider i dag. Det tar bara en minut.", url: "/mat", tag: "meal-2026-10-21" },
      ]),
    );
    expect(to(dueEp)).toHaveLength(2);
    expect(to(trainedEp)).toEqual([]);
    expect(to(laterEp)).toEqual([]);
    expect(to(goneEp)).toHaveLength(1);
    expect(to(flakyEp)).toHaveLength(1);
    expect(to(nyEp).map((p) => p.tag)).toEqual(["meal-2026-10-21"]);
    expect(to(badEp)).toEqual([]);

    expect((await admin.from("push_subscriptions").select("id").eq("endpoint", goneEp)).data).toEqual([]);
    const dueSub = (await admin.from("push_subscriptions").select("last_success_at").eq("endpoint", dueEp).single()).data!;
    expect(dueSub.last_success_at).not.toBeNull();
    expect((await admin.from("notification_deliveries").select("kind").eq("user_id", due.id).order("kind")).data).toEqual([{ kind: "meal_log" }, { kind: "workout" }]);
    expect((await admin.from("notification_deliveries").select("kind").eq("user_id", flaky.id)).data).toEqual([]);

    // The user can see their own delivery log.
    expect((await due.client.from("notification_deliveries").select("kind")).data).toHaveLength(2);

    // A second run (e.g. 15 minutes later) repeats nothing, but retries the temporary failure.
    calls.length = 0;
    await runReminderJob(admin, send, new Date(NOW.getTime() + 15 * 60_000));
    expect(to(dueEp)).toEqual([]);
    expect(to(nyEp)).toEqual([]);
    expect(to(flakyEp)).toHaveLength(1);

    // Three hours after the reminder time it is no longer due.
    calls.length = 0;
    await runReminderJob(admin, send, new Date("2026-10-21T19:01:00.000Z"));
    expect(to(flakyEp)).toEqual([]);
  });

  it("keeps a late-evening reminder due after local midnight", async () => {
    const late = await newUser();
    await withProgram(late.client, 3);
    await settings(late.client, late.id, { workout: "23:30", meal: "23:30" });
    const ep = endpoint("late");
    await subscribe(late.client, ep);
    const calls: { endpoint: string; tag: string }[] = [];
    const send: PushSender = async (target, payload) => void calls.push({ endpoint: target.endpoint, tag: JSON.parse(payload).tag });
    const mine = () => calls.filter((c) => c.endpoint === ep).map((c) => c.tag).sort();

    // 23:00 on Wednesday: not due yet.
    await runReminderJob(admin, send, new Date("2026-10-21T21:00:00.000Z"));
    expect(mine()).toEqual([]);
    // 00:15 on Thursday: Wednesday's reminders (Wednesday is the planned day) are still due.
    await runReminderJob(admin, send, new Date("2026-10-21T22:15:00.000Z"));
    expect(mine()).toEqual(["meal-2026-10-21", "workout-2026-10-21"]);
    // Nothing is repeated, and Thursday's reminders are not due before 23:30 on Thursday.
    await runReminderJob(admin, send, new Date("2026-10-22T00:20:00.000Z"));
    expect(mine()).toHaveLength(2);
  });
});
