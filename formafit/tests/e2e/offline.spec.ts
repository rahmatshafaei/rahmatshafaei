import { expect, test } from "@playwright/test";
import { newUser } from "./helpers";

test("sets logged without connection stay on the device and are synced when back online", async ({ page, context }) => {
  await newUser(page, "offline");
  await page.goto("/traning/program");
  await page.getByRole("button", { name: "Använd mall" }).first().click();
  await expect(page).toHaveURL(/\/traning\/program\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "Starta" }).first().click();
  await expect(page).toHaveURL(/\/traning\/pass\/[0-9a-f-]{36}/);

  // The production build registers the service worker; wait until it controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.getByLabel("Vikt set 1").first().fill("72,5");
  await page.getByLabel("Repetitioner set 1").first().fill("6");
  await page.getByRole("button", { name: "Markera set 1 som klart" }).first().click();
  await expect(page.getByText("Offline – 1 set sparade på enheten")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ångra set 1" }).first()).toBeVisible();

  // The session cannot be saved while sets are only on the device.
  await page.getByRole("button", { name: "Avsluta" }).click();
  await expect(page.getByText("1 set är inte skickade än")).toBeVisible();
  await expect(page.getByRole("button", { name: "Spara pass" })).toBeDisabled();
  await page.getByRole("button", { name: "Fortsätt träna" }).click();

  // Other actions explain that they need a connection instead of failing silently.
  await page.getByRole("button", { name: "Set", exact: true }).first().click();
  await expect(page.getByText("Ingen uppkoppling. Försök igen när du är online.")).toBeVisible();

  // The offline page is precached, and no private page is. (Playwright's offline mode does not
  // apply to the service worker's own requests; the fallback itself is unit-tested.)
  const cached = await page.evaluate(async () => {
    const keys = await Promise.all((await caches.keys()).map(async (k) => (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)));
    return keys.flat();
  });
  expect(cached).toContain("/offline.html");
  expect(cached.filter((p) => !p.startsWith("/_next/static/") && !["/offline.html", "/icon.svg", "/icon-192.png"].includes(p))).toEqual([]);

  // Back online: the queue is sent without reloading the page.
  await context.setOffline(false);
  await expect(page.getByText("Alla set är sparade.")).toBeVisible();
  await expect(page.getByText(/sparade på enheten|Skickar \d+ set/)).toHaveCount(0);

  await page.reload();
  await expect(page.getByLabel("Vikt set 1").first()).toHaveValue("72,5");
  await expect(page.getByLabel("Repetitioner set 1").first()).toHaveValue("6");
  await expect(page.getByRole("button", { name: "Ångra set 1" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Avsluta" }).click();
  await page.getByRole("button", { name: "Spara pass" }).click();
  await expect(page.getByText("Snyggt jobbat! Passet är sparat.")).toBeVisible();
});
