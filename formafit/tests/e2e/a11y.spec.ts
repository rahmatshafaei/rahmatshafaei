import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { newUser } from "./helpers";

/**
 * Automated WCAG 2.1 A/AA checks (axe-core) on the main screens, in the light and the dark
 * theme. Automated checks find only part of the possible problems; they do not replace manual
 * testing with a screen reader and the keyboard.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function violations(page: Page) {
  // Wait for client-rendered content (charts, timers) to settle before scanning.
  await page.waitForLoadState("networkidle");
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return result.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(" ")} :: ${n.failureSummary?.split("\n").slice(1).join(" ").trim()}`),
  }));
}

async function scan(page: Page, path: string, theme: "light" | "dark") {
  await page.evaluate((t) => localStorage.setItem("formafit:theme", t), theme);
  await page.goto(path);
  expect.soft(await violations(page), `${path} (${theme})`).toEqual([]);
}

test("public pages have no detectable WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["light", "dark"] as const) {
    for (const path of ["/", "/logga-in", "/registrera", "/integritet"]) await scan(page, path, theme);
  }
});

test("app screens have no detectable WCAG A/AA violations", async ({ page }) => {
  test.setTimeout(180_000);
  await newUser(page, "a11y");

  // Some content on each screen: a program, an open session and a logged food.
  await page.goto("/traning/program");
  await page.getByRole("button", { name: "Använd mall" }).first().click();
  await expect(page).toHaveURL(/\/traning\/program\/[0-9a-f-]{36}/);
  const programPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Starta" }).first().click();
  await expect(page).toHaveURL(/\/traning\/pass\/[0-9a-f-]{36}/);
  const sessionPath = new URL(page.url()).pathname;

  const paths = [
    "/hem",
    "/mat",
    "/mat/livsmedel",
    "/mat/recept",
    "/mat/planer",
    "/mat/inkop",
    "/traning",
    "/traning/program",
    programPath,
    "/traning/ovningar",
    "/traning/historik",
    sessionPath,
    "/framsteg",
    "/framsteg/matt",
    "/coach",
    "/profil",
  ];
  for (const theme of ["light", "dark"] as const) {
    for (const path of paths) await scan(page, path, theme);
  }
});
