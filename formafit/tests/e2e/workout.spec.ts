import { expect, test } from "@playwright/test";
import { newUser } from "./helpers";

test("create a program, run a workout with persisted sets and complete it", async ({ page }) => {
  await newUser(page, "workout");
  await page.goto("/traning/program");
  await page.getByRole("button", { name: "Använd mall" }).first().click();
  await expect(page).toHaveURL(/\/traning\/program\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: "Helkropp 3 dagar" })).toBeVisible();

  await page.getByRole("button", { name: "Gör aktivt" }).click();
  await page.getByRole("button", { name: "Gör aktivt" }).last().click();
  await expect(page.getByRole("button", { name: "Aktivt" })).toBeVisible();

  await page.getByRole("button", { name: "Starta" }).first().click();
  await expect(page).toHaveURL(/\/traning\/pass\/[0-9a-f-]{36}/);

  // A workout cannot be completed before any set is logged.
  await page.getByRole("button", { name: "Avsluta" }).click();
  await expect(page.getByText(/kan bara avslutas när minst ett set/)).toBeVisible();
  await page.getByRole("button", { name: "Fortsätt träna" }).click();

  await page.getByLabel("Vikt set 1").first().fill("70");
  await page.getByLabel("Repetitioner set 1").first().fill("8");
  await page.getByRole("button", { name: "Markera set 1 som klart" }).first().click();
  await expect(page.getByRole("timer")).toBeVisible();

  // Progress survives a reload.
  await page.reload();
  await expect(page.getByLabel("Vikt set 1").first()).toHaveValue("70");
  await expect(page.getByRole("button", { name: "Ångra set 1" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Pausa passet" }).click();
  await expect(page.getByText("Passet är pausat")).toBeVisible();
  await page.getByRole("button", { name: "Fortsätt passet" }).click();

  await page.getByRole("button", { name: "Avsluta" }).click();
  await page.getByRole("button", { name: "Lagom" }).click();
  await page.getByRole("button", { name: "Spara pass" }).click();
  await expect(page.getByText("560 kg")).toBeVisible();

  await page.goto("/traning/historik");
  await expect(page.getByText("Helkropp A")).toBeVisible();
  await page.goto("/traning");
  await expect(page.getByText("Genomfört").first()).toBeVisible();
});
