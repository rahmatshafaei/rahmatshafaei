import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { newUser, PASSWORD } from "./helpers";

// 1×1 transparent PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

test("export data, then delete the account permanently", async ({ page }) => {
  const email = await newUser(page, "account");

  // A private progress photo that must be removed together with the account.
  await page.goto("/framsteg/foton");
  await page.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Spara" }).click();
  await expect(page.getByText("Bilden är sparad privat")).toBeVisible();

  await page.goto("/profil");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportera mina data (JSON)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^formafit-export-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.email).toBe(email);
  expect(exported.data.profiles[0].display_name).toBe("Testa");
  expect(exported.data.measurements).toHaveLength(1);
  expect(exported.data.progress_photos).toHaveLength(1);
  const photoPath: string = exported.data.progress_photos[0].storage_path;

  await page.getByRole("button", { name: "Radera konto" }).click();
  await page.getByLabel("Lösenord").fill("fel-losenord");
  await page.getByLabel("Skriv RADERA för att bekräfta").fill("RADERA");
  await page.getByRole("button", { name: "Radera kontot" }).click();
  await expect(page.getByText("Fel lösenord.")).toBeVisible();

  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Radera kontot" }).click();
  await expect(page).toHaveURL(/\/\?konto=raderat/);
  await expect(page.getByText("Ditt konto är raderat")).toBeVisible();

  await page.goto("/hem");
  await expect(page).toHaveURL(/\/logga-in/);
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page.getByText("Fel e-postadress eller lösenord.")).toBeVisible();

  // The uploaded file is gone from storage (checked with test-only service credentials).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });
    const { data } = await admin.storage.from("progress-photos").list(photoPath.split("/").slice(0, -1).join("/"));
    expect(data ?? []).toEqual([]);
  }
});
