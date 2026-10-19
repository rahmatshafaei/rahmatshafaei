/**
 * Open Food Facts integration (https://world.openfoodfacts.org, data licensed ODbL,
 * images CC BY-SA). Product data is community-contributed, so imported foods are stored
 * with verification "community" and allergen information is never treated as complete.
 */
import { z } from "zod";

const BASE = "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,product_name_sv,brands,nutriments,image_front_small_url,allergens_tags,categories_tags,quantity";

const ALLERGEN_MAP: Record<string, string> = {
  "en:gluten": "gluten",
  "en:milk": "milk",
  "en:eggs": "egg",
  "en:fish": "fish",
  "en:crustaceans": "shellfish",
  "en:molluscs": "shellfish",
  "en:nuts": "nuts",
  "en:peanuts": "peanuts",
  "en:soybeans": "soy",
  "en:sesame-seeds": "sesame",
  "en:celery": "celery",
  "en:mustard": "mustard",
};

const CATEGORY_RULES: [RegExp, "meat_fish" | "dairy" | "grains" | "produce" | "pantry" | "other"][] = [
  [/en:(meats|fishes|seafood|poultry|sausages)/, "meat_fish"],
  [/en:(dairies|milks|cheeses|yogurts|plant-based-milk|eggs)/, "dairy"],
  [/en:(cereals|pastas|breads|rices|breakfast-cereals)/, "grains"],
  [/en:(fruits|vegetables|fresh-vegetables|fresh-fruits)/, "produce"],
  [/en:(condiments|sauces|oils|canned|spices|sweeteners|legumes)/, "pantry"],
];

const nutrient = (max: number) =>
  z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  }, z.number().nullable());

const productSchema = z.object({
  code: z.string().regex(/^[0-9]{6,14}$/),
  product_name: z.string().optional(),
  product_name_sv: z.string().optional(),
  brands: z.string().optional(),
  image_front_small_url: z.string().optional(),
  allergens_tags: z.array(z.string()).optional(),
  categories_tags: z.array(z.string()).optional(),
  nutriments: z
    .object({
      "energy-kcal_100g": nutrient(900),
      energy_100g: nutrient(3800),
      proteins_100g: nutrient(100),
      carbohydrates_100g: nutrient(100),
      fat_100g: nutrient(100),
      fiber_100g: nutrient(100),
    })
    .partial()
    .optional(),
});

export interface OffFood {
  barcode: string;
  name: string;
  brand: string | null;
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  fiber_per_100g: number | null;
  allergens: string[];
  category: "meat_fish" | "dairy" | "grains" | "produce" | "pantry" | "other";
  image_url: string | null;
  energyFromKj: boolean;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Normalises an Open Food Facts product. Returns null when it is unusable. */
export function parseOffProduct(raw: unknown): OffFood | null {
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const name = (p.product_name_sv || p.product_name || "").trim();
  if (!name) return null;
  const n = p.nutriments ?? {};
  let kcal = n["energy-kcal_100g"] ?? null;
  let energyFromKj = false;
  if (kcal === null && n.energy_100g != null) {
    // Deterministic unit conversion from kJ (1 kcal = 4.184 kJ), not an estimate.
    kcal = round2(n.energy_100g / 4.184);
    energyFromKj = true;
  }
  let protein = n.proteins_100g ?? null;
  let carbs = n.carbohydrates_100g ?? null;
  let fat = n.fat_100g ?? null;
  if ((protein ?? 0) + (carbs ?? 0) + (fat ?? 0) > 100.5) {
    // Inconsistent record: keep energy but do not trust the macros.
    protein = carbs = fat = null;
  }
  const categories = (p.categories_tags ?? []).join(" ");
  const category = CATEGORY_RULES.find(([re]) => re.test(categories))?.[1] ?? "other";
  const allergens = [...new Set((p.allergens_tags ?? []).map((t) => ALLERGEN_MAP[t]).filter(Boolean))];
  if (allergens.includes("milk")) allergens.push("lactose");
  const image = p.image_front_small_url?.startsWith("https://") ? p.image_front_small_url : null;
  return {
    barcode: p.code,
    name: name.slice(0, 200),
    brand: p.brands?.split(",")[0]?.trim().slice(0, 120) || null,
    kcal_per_100g: kcal,
    protein_per_100g: protein,
    carbs_per_100g: carbs,
    fat_per_100g: fat,
    fiber_per_100g: n.fiber_100g ?? null,
    allergens: [...new Set(allergens)],
    category,
    image_url: image,
    energyFromKj,
  };
}

export class OffUnavailableError extends Error {}

async function offFetch(url: string, userAgent: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new OffUnavailableError(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } catch (e) {
    throw e instanceof OffUnavailableError ? e : new OffUnavailableError(String(e));
  } finally {
    clearTimeout(timer);
  }
}

export async function searchOffProducts(query: string, userAgent: string, timeoutMs = 4500): Promise<OffFood[]> {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12&lc=sv&fields=${FIELDS}`;
  const body = (await offFetch(url, userAgent, timeoutMs)) as { products?: unknown[] };
  return (body.products ?? []).map(parseOffProduct).filter((p): p is OffFood => p !== null);
}

export async function getOffProduct(barcode: string, userAgent: string, timeoutMs = 4500): Promise<OffFood | null> {
  if (!/^[0-9]{6,14}$/.test(barcode)) return null;
  const body = (await offFetch(`${BASE}/api/v2/product/${barcode}.json?fields=${FIELDS}`, userAgent, timeoutMs)) as {
    status?: number;
    product?: unknown;
  };
  if (body.status !== 1 || !body.product) return null;
  return parseOffProduct(body.product);
}
