import { expect, test } from "@playwright/test";
import { newUser } from "./helpers";

test("progress shows only recorded data", async ({ page }) => {
  await newUser(page, "progress");
  await page.goto("/framsteg");
  // Onboarding recorded one weigh-in; a chart needs at least two.
  await expect(page.getByText("Väg dig minst två gånger")).toBeVisible();

  await page.goto("/framsteg/matt");
  const lastWeek = await page.evaluate(() => {
    const d = new Date(Date.now() - 7 * 86_400_000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm" }).format(d);
  });
  await page.getByLabel("Datum").fill(lastWeek);
  await page.getByLabel("Vikt").fill("81,2");
  await page.getByLabel("Midja").fill("88");
  await page.getByRole("button", { name: "Spara" }).click();
  await expect(page.getByText("Mätningen är sparad")).toBeVisible();
  await expect(page.getByRole("cell", { name: "81,2 kg" })).toBeVisible();

  await page.goto("/framsteg");
  await expect(page.getByRole("img", { name: "Diagram över kroppsvikt" })).toBeVisible();
  await expect(page.getByText(/Veckosnittet för vikten ändrades −?-?1,2 kg/)).toBeVisible();
  await page.getByRole("button", { name: "Visa tabell" }).first().click();
  await expect(page.getByRole("cell", { name: "81,2 kg" })).toBeVisible();
});
