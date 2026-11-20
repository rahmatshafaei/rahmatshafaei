#!/usr/bin/env node
/**
 * Imports Livsmedelsverket's food database (Livsmedelsdatabasen, CC BY 4.0) as verified shared
 * reference foods. Fetches every food and its nutrient values from the public API and writes a
 * migration that inserts or updates them, so every environment gets the same data through
 * `supabase db push`. Running it again later produces a new migration with updated values.
 *
 * Usage: node scripts/import-livsmedelsverket.mjs [--out <file>] [--limit <n>]
 * Needs network access to dataportal.livsmedelsverket.se (the CI workflow
 * .github/workflows/formafit-food-import.yml runs it and commits the result).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_BASE, toFoodRow, toMigrationSql } from "./lib/livsmedelsverket.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const today = new Date().toISOString().slice(0, 10);
const out = path.resolve(root, arg("--out") ?? `supabase/migrations/${today.replaceAll("-", "")}000200_livsmedelsverket_foods.sql`);
const maxFoods = arg("--limit") ? Number(arg("--limit")) : Infinity;

const PAGE_SIZE = 500;
const CONCURRENCY = 6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with retries for network errors, 429 and 5xx (exponential backoff). */
async function getJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "FormaFit food import" } });
    if (res.ok) return await res.json();
    if (res.status !== 429 && res.status < 500) throw Object.assign(new Error(`${res.status} ${url}`), { fatal: true });
    throw new Error(`${res.status} ${url}`);
  } catch (e) {
    if (e.fatal || attempt >= 6) throw e;
    await sleep(500 * 2 ** attempt);
    return getJson(url, attempt + 1);
  }
}

async function listFoods() {
  const foods = [];
  for (let offset = 0; foods.length < maxFoods; offset += PAGE_SIZE) {
    const page = await getJson(`${API_BASE}/livsmedel?offset=${offset}&limit=${PAGE_SIZE}&sprak=1`);
    foods.push(...(page.livsmedel ?? []));
    if (offset + PAGE_SIZE >= (page._meta?.totalRecords ?? 0)) break;
  }
  return foods.slice(0, maxFoods);
}

async function mapWithConcurrency(items, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

const info = await getJson(`${API_BASE}/api-info`).catch(() => null);
const foods = await listFoods();
console.log(`Fetching nutrient values for ${foods.length} foods …`);

const rows = [];
const skipped = [];
await mapWithConcurrency(foods, async (food, i) => {
  const values = await getJson(`${API_BASE}/livsmedel/${food.nummer}/naringsvarden?sprak=1`);
  const result = toFoodRow(food, Array.isArray(values) ? values : []);
  if ("row" in result) rows.push(result.row);
  else skipped.push({ nummer: food.nummer, namn: food.namn, reason: result.skip });
  if ((i + 1) % 250 === 0) console.log(`  ${i + 1}/${foods.length}`);
});

skipped.sort((a, b) => a.nummer - b.nummer);
writeFileSync(out, toMigrationSql(rows, { retrievedOn: today, apiVersion: info?.apiVersion ?? null, skipped }));
console.log(`Wrote ${rows.length} foods to ${path.relative(root, out)} (${skipped.length} skipped).`);
for (const s of skipped) console.log(`  skipped ${s.nummer} ${s.namn}: ${s.reason}`);
