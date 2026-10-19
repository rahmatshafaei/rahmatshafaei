import { expect, test } from "@playwright/test";
import { addFoodToSlot, newUser } from "./helpers";

test("log, edit and delete foods; totals come from persisted entries", async ({ page }) => {
  await newUser(page, "diary");
  await page.goto("/mat");

  // Havregryn: 367 kcal/100 g (starter estimate) → 60 g = 220 kcal.
  await addFoodToSlot(page, "Frukost", "havregryn", "Havregryn", "60");
  // Mjölk 1,5 %: 4·3,5 + 4·4,8 + 9·1,5 = 46,7 kcal/100 g → 200 g = 93,4 kcal; total 313,6 → 314.
  await addFoodToSlot(page, "Frukost", "mjölk", "Mjölk 1,5 %", "200");

  const ate = page.getByText("Ätit").locator("..");
  await expect(ate).toContainText("314");

  await page.reload();
  await expect(page.getByText("Ätit").locator("..")).toContainText("314");

  // Edit quantity: 60 g → 100 g havregryn = 367 kcal; total 460,4 → 460.
  await page.getByRole("button", { name: /^Havregryn/ }).click();
  await page.getByLabel("Mängd", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Spara" }).click();
  await expect(page.getByText("Ätit").locator("..")).toContainText("460");

  // Invalid quantity is rejected client- and server-side.
  await page.getByRole("button", { name: /^Havregryn/ }).click();
  await page.getByLabel("Mängd", { exact: true }).fill("0");
  await expect(page.getByText("Ange 1–5000 g.")).toBeVisible();
  await page.getByRole("button", { name: "Avbryt" }).click();

  // Delete the milk.
  await page.getByRole("button", { name: "Val för Mjölk 1,5 %" }).click();
  await page.getByRole("menuitem", { name: "Ta bort" }).click();
  await expect(page.getByText("Ätit").locator("..")).toContainText("367");

  // Water
  await page.getByRole("button", { name: "+ 500 ml" }).click();
  await expect(page.getByText("0,5 av 2,5 l")).toBeVisible();
});
