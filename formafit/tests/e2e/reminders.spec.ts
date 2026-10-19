import { expect, test } from "@playwright/test";
import { newUser, PASSWORD } from "./helpers";

/**
 * Headless Chromium cannot create real push subscriptions (there is no push service), so the
 * browser's PushManager is replaced by a stand-in that hands out a fake https endpoint. The
 * rest is real: permission flow, server registration, logout cleanup and the reminder job.
 */
const FAKE_PUSH = () => {
  const KEY = "e2e:push-subscription";
  type Stored = { endpoint: string; key: number[]; p256dh: string; auth: string };
  const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const toSub = (s: Stored) => ({
    endpoint: s.endpoint,
    options: { applicationServerKey: new Uint8Array(s.key).buffer },
    toJSON: () => ({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }),
    unsubscribe: async () => {
      localStorage.removeItem(KEY);
      return true;
    },
  });
  PushManager.prototype.subscribe = async function (options?: PushSubscriptionOptionsInit) {
    const key = options?.applicationServerKey as Uint8Array;
    // A real browser key pair, so the server-side encryption runs exactly as in production.
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const stored: Stored = {
      endpoint: `https://push.example.test/e2e/${crypto.randomUUID()}`,
      key: Array.from(key),
      p256dh: b64url(publicKey),
      auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
    };
    localStorage.setItem(KEY, JSON.stringify(stored));
    return toSub(stored) as unknown as PushSubscription;
  };
  PushManager.prototype.getSubscription = async function () {
    const raw = localStorage.getItem(KEY);
    return raw ? (toSub(JSON.parse(raw)) as unknown as PushSubscription) : null;
  };
};

test.use({ permissions: ["notifications"] });

test("reminders: enable on a device, save times, clean up on logout, and protect the job", async ({ page, request }) => {
  await page.addInitScript(FAKE_PUSH);
  const email = await newUser(page, "reminders");
  await page.goto("/profil");
  const card = page.getByRole("region", { name: "Påminnelser" });

  await card.getByRole("button", { name: "Aktivera notiser på den här enheten" }).click();
  await expect(card.getByText("Notiser är på för den här enheten")).toBeVisible();
  await expect(card.getByText("1 enhet får notiser.")).toBeVisible();

  // A reminder that is due right now (one minute ago, Stockholm time).
  const local = new Date(Date.now() - 60_000).toLocaleTimeString("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" });
  const nearMidnight = local < "00:02";
  await card.getByRole("checkbox", { name: "Påminn mig att logga maten" }).check();
  await card.getByLabel("Tid för påminn mig att logga maten").fill(local);
  await card.getByRole("button", { name: "Spara påminnelser" }).click();
  await expect(page.getByText("Påminnelserna är sparade.")).toBeVisible();

  await page.reload();
  await expect(card.getByRole("checkbox", { name: "Påminn mig att logga maten" })).toBeChecked();
  await expect(card.getByLabel("Tid för påminn mig att logga maten")).toHaveValue(local);
  await expect(card.getByRole("checkbox", { name: "Träningspåminnelse" })).not.toBeChecked();
  await expect(card.getByText("Kräver ett aktivt program där passen har veckodagar.")).toBeVisible();
  await expect(card.getByText("Tiderna gäller i tidszonen Europe/Stockholm.")).toBeVisible();
  await expect(card.getByText("Notiser är på för den här enheten")).toBeVisible();

  // The job endpoint is closed without the secret.
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  expect((await request.get("/api/cron/reminders", { headers: { Authorization: "Bearer fel" } })).status()).toBe(401);
  const run = await request.post("/api/cron/reminders", { headers: { Authorization: `Bearer ${process.env.E2E_CRON_SECRET}` } });
  expect(run.status()).toBe(200);
  const counts = await run.json();
  expect(Object.keys(counts).sort()).toEqual(["due", "failed", "notified", "removed", "sent", "skipped"]);
  if (!nearMidnight) expect(counts.due).toBeGreaterThanOrEqual(1);

  // Turning it off on this device removes the subscription.
  await card.getByRole("button", { name: "Stäng av här" }).click();
  await expect(card.getByRole("button", { name: "Aktivera notiser på den här enheten" })).toBeVisible();
  await expect(card.getByText(/enhet(er)? får notiser/)).toHaveCount(0);

  // Logging out removes this device's subscription as well.
  await card.getByRole("button", { name: "Aktivera notiser på den här enheten" }).click();
  await expect(card.getByText("1 enhet får notiser.")).toBeVisible();
  await page.getByRole("button", { name: "Logga ut" }).last().click();
  await expect(page).toHaveURL(/\/logga-in/);
  expect(await page.evaluate(() => localStorage.getItem("e2e:push-subscription"))).toBeNull();

  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/hem/);
  await page.goto("/profil");
  await expect(card.getByRole("button", { name: "Aktivera notiser på den här enheten" })).toBeVisible();
  await expect(card.getByText(/enhet(er)? får notiser/)).toHaveCount(0);
});
