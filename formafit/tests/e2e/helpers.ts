import { expect, type Page } from "@playwright/test";

export const PASSWORD = "E2e-Losenord-123";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

export async function register(page: Page, email: string, password = PASSWORD) {
  await page.goto("/registrera");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord", { exact: true }).fill(password);
  await page.locator('input[name="terms"]').check();
  await page.getByRole("button", { name: "Skapa konto" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
}

/** Completes onboarding with fixed values (male, 30 y, 180 cm, 80 kg, moderate, maintenance). */
export async function onboard(page: Page, options: { allergies?: string[] } = {}) {
  await page.getByLabel("Namn eller smeknamn").fill("Testa");
  await page.getByLabel("Ålder").fill("30");
  await page.getByLabel("Längd").fill("180");
  await page.getByText("Man", { exact: true }).click();
  await page.getByRole("button", { name: "Fortsätt" }).click();
  await page.getByLabel("Nuvarande vikt").fill("80");
  await page.getByText("Bibehålla", { exact: true }).click();
  await page.getByRole("button", { name: "Fortsätt" }).click();
  await page.getByText(/^Måttligt aktiv/).click();
  await page.getByRole("button", { name: "Fortsätt" }).click();
  for (const a of options.allergies ?? []) await page.getByRole("button", { name: a, exact: true }).click();
  await page.getByRole("button", { name: "Fortsätt" }).click();
  await page.getByText("Van", { exact: true }).click();
  await page.getByRole("button", { name: "Fullt gym" }).click();
  await page.getByRole("button", { name: "Fortsätt" }).click();
  await expect(page.getByText("Föreslaget dagligt mål")).toBeVisible();
  await page.getByRole("button", { name: "Spara och börja" }).click();
  await expect(page).toHaveURL(/\/hem/);
}

export async function newUser(page: Page, prefix: string, options?: { allergies?: string[] }) {
  const email = uniqueEmail(prefix);
  await register(page, email);
  await onboard(page, options);
  return email;
}

/** Adds a food to a diary slot via the food picker. */
export async function addFoodToSlot(page: Page, slotLabel: string, query: string, foodName: string, grams: string) {
  await page.getByRole("button", { name: `Lägg till i ${slotLabel}` }).click();
  await page.getByLabel("Sök livsmedel").fill(query);
  await page.getByRole("button", { name: new RegExp(`^${foodName}`) }).first().click();
  await page.getByLabel("Mängd", { exact: true }).fill(grams);
  await page.getByRole("button", { name: "Lägg till", exact: true }).click();
  await expect(page.getByText(`${foodName} tillagd`)).toBeVisible();
}
