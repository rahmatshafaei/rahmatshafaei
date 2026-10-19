import { expect, test } from "@playwright/test";
import { onboard, PASSWORD, register, uniqueEmail } from "./helpers";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

test("registration, onboarding, logout, login and protected routes", async ({ page }) => {
  await page.goto("/hem");
  await expect(page).toHaveURL(/\/logga-in\?next=%2Fhem/);

  const email = uniqueEmail("auth");
  await register(page, email);
  // Onboarding is enforced before the app is reachable.
  await page.goto("/mat");
  await expect(page).toHaveURL(/\/onboarding/);
  await onboard(page);

  // Mifflin–St Jeor: 10·80 + 6.25·180 − 5·30 + 5 = 1780 kcal; × 1.55 = 2759 → 2760 kcal.
  await expect(page.getByText("2 760").first()).toBeVisible();

  await page.goto("/profil");
  await page.getByRole("button", { name: "Logga ut" }).last().click();
  await expect(page).toHaveURL(/\/logga-in/);
  await page.goto("/hem");
  await expect(page).toHaveURL(/\/logga-in/);

  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord", { exact: true }).fill("fel-losenord");
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page.getByText("Fel e-postadress eller lösenord.")).toBeVisible();

  await page.getByLabel("Lösenord", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/hem/);

  // The session persists across reloads.
  await page.reload();
  await expect(page.getByRole("heading", { name: /Testa/ })).toBeVisible();
});

test("password recovery via email link", async ({ page, request }) => {
  const email = uniqueEmail("reset");
  await register(page, email);
  await onboard(page);
  await page.context().clearCookies();

  await page.goto("/glomt-losenord");
  await page.getByLabel("E-post").fill(email);
  await page.getByRole("button", { name: "Skicka återställningslänk" }).click();
  await expect(page.getByText(/Om det finns ett konto/)).toBeVisible();

  // Read the recovery email from the local Supabase mail catcher (Mailpit).
  let link: string | undefined;
  await expect
    .poll(async () => {
      const list = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
      const messages = (await list.json()).messages ?? [];
      if (!messages.length) return false;
      const msg = await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
      const html: string = (await msg.json()).HTML ?? "";
      link = /href="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
      return Boolean(link);
    }, { timeout: 20_000 })
    .toBe(true);

  await page.goto(link!);
  await expect(page).toHaveURL(/\/aterstall-losenord/);
  await page.getByLabel("Nytt lösenord").fill("Nytt-Losenord-456");
  await page.getByLabel("Upprepa lösenord").fill("Nytt-Losenord-456");
  await page.getByRole("button", { name: "Spara nytt lösenord" }).click();
  await expect(page).toHaveURL(/\/hem/);

  await page.context().clearCookies();
  await page.goto("/logga-in");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord", { exact: true }).fill("Nytt-Losenord-456");
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/hem/);
});
