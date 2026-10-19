import { expect, test } from "@playwright/test";
import { newUser } from "./helpers";

test("create a meal plan, mark a meal eaten idempotently and generate a grocery list", async ({ page }) => {
  await newUser(page, "plan");
  await page.goto("/mat/planer");
  await page.getByRole("button", { name: "Ny plan" }).first().click();
  const today = await page.evaluate(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm" }).format(new Date()));
  await page.getByLabel("Startdatum").fill(today);
  await page.getByLabel("Längd").selectOption("3");
  await page.getByRole("button", { name: "Skapa", exact: true }).click();
  await expect(page).toHaveURL(/\/mat\/planer\/[0-9a-f-]{36}/);

  await page.getByRole("button", { name: "Lägg till måltid" }).click();
  await page.getByLabel("Måltid", { exact: true }).selectOption("lunch");
  await page.getByLabel("Namn").fill("Kyckling och ris");
  await page.getByRole("button", { name: "Lägg till", exact: true }).click();
  await expect(page.getByText("Kyckling och ris")).toBeVisible();

  for (const [query, name, grams] of [
    ["kycklingbröst", "Kycklingbröstfilé, rå", "150"],
    ["jasminris", "Jasminris, okokt", "75"],
  ]) {
    await page.getByRole("button", { name: "Ingrediens" }).click();
    await page.getByLabel("Sök livsmedel").fill(query);
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
    await page.getByLabel("Mängd", { exact: true }).fill(grams);
    await page.getByRole("button", { name: "Lägg till", exact: true }).click();
    await expect(page.getByLabel(`Mängd ${name}`)).toHaveValue(grams);
  }

  // Chicken 105,5 kcal/100 g × 150 g = 158,25; dry rice 347,4 kcal/100 g × 75 g = 260,55 → 418,8 ≈ 419 kcal.
  await expect(page.getByText(/419 kcal/).first()).toBeVisible();

  // Copy the day to day 2 → the grocery list should double the quantities.
  await page.getByRole("button", { name: "Kopiera dag" }).click();
  await page.getByRole("button", { name: "Kopiera", exact: true }).click();
  await expect(page.getByText("1 måltider kopierade")).toBeVisible();

  await page.getByRole("tab").first().click();
  await page.getByRole("button", { name: "Val för Kyckling och ris" }).click();
  await page.getByRole("menuitem", { name: "Markera som äten" }).click();
  await expect(page.getByText(/Tillagd i dagboken/)).toBeVisible();
  await page.getByRole("button", { name: "Val för Kyckling och ris" }).click();
  await expect(page.getByRole("menuitem", { name: "Ångra äten" })).toBeVisible();
  await page.keyboard.press("Escape");

  // The diary got the meal exactly once.
  await page.goto("/mat");
  await expect(page.getByText("Ätit").locator("..")).toContainText("419");
  await expect(page.getByRole("button", { name: /^Kycklingbröstfilé, rå/ })).toHaveCount(1);
  // Marking again from the diary is a no-op.
  await expect(page.getByRole("button", { name: "Ångra" })).toBeVisible();

  await page.goBack();
  await page.getByRole("button", { name: "Inköpslista" }).click();
  await page.getByRole("button", { name: "Skapa lista" }).click();
  await expect(page).toHaveURL(/\/mat\/inkop\/[0-9a-f-]{36}/);
  await expect(page.getByRole("checkbox", { name: /Kycklingbröstfilé, rå.*300 g/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Jasminris, okokt.*torr vikt.*150 g/ })).toBeVisible();

  await page.getByRole("checkbox", { name: /Jasminris/ }).click();
  await expect(page.getByText("1/2 köpta")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1/2 köpta")).toBeVisible();
});
