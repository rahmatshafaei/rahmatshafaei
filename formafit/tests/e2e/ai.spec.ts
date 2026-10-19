import { expect, test } from "@playwright/test";
import { newUser } from "./helpers";

// Uses the real Claude API when ANTHROPIC_API_KEY is set, otherwise the local mock server.
const realAi = Boolean(process.env.ANTHROPIC_API_KEY);
const MOCK = "http://127.0.0.1:4010";

test("AI meal plan generation: review, edit and save as a new plan", async ({ page, request }) => {
  test.setTimeout(realAi ? 240_000 : 90_000);
  await newUser(page, "aiplan", { allergies: ["Fisk"] });
  await page.goto("/mat/planer/generera");
  await page.getByLabel("Antal dagar").selectOption("1");
  await page.getByLabel("Måltider per dag").fill("3");
  await page.getByRole("button", { name: "Generera förslag" }).click();
  await expect(page.getByText("AI-förslag – inte sparat")).toBeVisible({ timeout: realAi ? 200_000 : 30_000 });

  if (!realAi) {
    const sent = (await (await request.get(`${MOCK}/__requests`)).json()) as { beta: string; body: { output_config: { format: { type: string } }; fallbacks: string; system: string; messages: { content: string }[] } }[];
    const req = sent.findLast((r) => r.body.system.includes("kostplanerare"))!;
    expect(req.beta).toContain("server-side-fallback-2026-07-01");
    expect(req.body.fallbacks).toBe("default");
    expect(req.body.output_config.format.type).toBe("json_schema");
    const prompt = req.body.messages[0].content;
    // Only candidate references are sent – no database ids, no fish for a fish allergy.
    expect(prompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    expect(prompt).not.toContain("Laxfilé");
    expect(prompt).toContain("Allergier/intoleranser: Fisk");
  }

  await page.getByLabel("Namn på planen").fill("Min AI-plan");
  await page.getByRole("button", { name: "Spara som ny plan" }).click();
  await expect(page).toHaveURL(/\/mat\/planer\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: "Min AI-plan" })).toBeVisible();
  await expect(page.getByText("Skapad från AI-förslag")).toBeVisible();
});

test("AI coach streams a reply and keeps the conversation", async ({ page }) => {
  test.setTimeout(realAi ? 180_000 : 60_000);
  await newUser(page, "coach");
  await page.goto("/coach");
  await page.getByLabel("Meddelande till coachen").fill("Hur mycket protein bör jag äta per dag?");
  await page.getByRole("button", { name: "Skicka" }).click();
  await expect(page).toHaveURL(/\/coach\/[0-9a-f-]{36}/);
  const reply = page.locator("text=Coachen:").locator("..");
  await expect(reply.last()).not.toBeEmpty({ timeout: realAi ? 150_000 : 20_000 });
  await expect(page.getByRole("button", { name: "Skicka" })).toBeVisible({ timeout: realAi ? 150_000 : 20_000 });
  await page.reload();
  await expect(page.locator("p.whitespace-pre-wrap", { hasText: "Hur mycket protein bör jag äta per dag?" })).toBeVisible();
  await expect(page.locator("text=Coachen:")).toHaveCount(1);
});

test("AI workout generation is saved as a new inactive program", async ({ page }) => {
  test.setTimeout(realAi ? 240_000 : 90_000);
  await newUser(page, "aiworkout");
  await page.goto("/traning/generera");
  await page.getByRole("button", { name: "Generera förslag" }).click();
  await expect(page.getByText("AI-förslag – inte sparat")).toBeVisible({ timeout: realAi ? 200_000 : 30_000 });
  await page.getByRole("button", { name: "Spara som nytt program" }).click();
  await expect(page).toHaveURL(/\/traning\/program\/[0-9a-f-]{36}/);
  await expect(page.getByText("Från AI-förslag")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gör aktivt" })).toBeVisible();
});
