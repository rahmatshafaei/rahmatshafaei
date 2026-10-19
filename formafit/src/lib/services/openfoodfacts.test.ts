import { afterEach, describe, expect, it, vi } from "vitest";
import { getOffProduct, OffUnavailableError, parseOffProduct, searchOffProducts } from "./openfoodfacts";

const product = {
  code: "7310865004703",
  product_name: "Mellanmjölk",
  product_name_sv: "Mellanmjölk 1,5 %",
  brands: "Arla, Arla Foods",
  image_front_small_url: "https://images.openfoodfacts.org/x.jpg",
  allergens_tags: ["en:milk"],
  categories_tags: ["en:dairies", "en:milks"],
  nutriments: { "energy-kcal_100g": 46, proteins_100g: 3.5, carbohydrates_100g: 4.8, fat_100g: 1.5 },
};

describe("parseOffProduct", () => {
  it("normalises a product without inventing values", () => {
    const p = parseOffProduct(product)!;
    expect(p).toMatchObject({ barcode: "7310865004703", name: "Mellanmjölk 1,5 %", brand: "Arla", kcal_per_100g: 46, fiber_per_100g: null, category: "dairy" });
    expect(p.allergens).toEqual(["milk", "lactose"]);
  });

  it("converts kJ to kcal deterministically when kcal is missing", () => {
    const p = parseOffProduct({ ...product, nutriments: { energy_100g: 418.4 } })!;
    expect(p.kcal_per_100g).toBe(100);
    expect(p.energyFromKj).toBe(true);
    expect(p.protein_per_100g).toBeNull();
  });

  it("drops inconsistent macros and out-of-range values", () => {
    const p = parseOffProduct({ ...product, nutriments: { "energy-kcal_100g": 2000, proteins_100g: 80, carbohydrates_100g: 80, fat_100g: 1 } })!;
    expect(p.kcal_per_100g).toBeNull();
    expect(p.protein_per_100g).toBeNull();
  });

  it("rejects unusable products", () => {
    expect(parseOffProduct({ code: "abc" })).toBeNull();
    expect(parseOffProduct({ code: "12345678" })).toBeNull();
    expect(parseOffProduct({ ...product, image_front_small_url: "http://insecure" })?.image_url).toBeNull();
  });
});

describe("Open Food Facts client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("searches and filters unusable products", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ products: [product, { code: "1" }] }))));
    const results = await searchOffProducts("mjölk", "FormaFit/test");
    expect(results).toHaveLength(1);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("search_terms=mj%C3%B6lk");
    expect((init as RequestInit).headers).toMatchObject({ "User-Agent": "FormaFit/test" });
  });

  it("returns null for unknown barcodes and errors when the service is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: 0 }))));
    expect(await getOffProduct("7310865004703", "ua")).toBeNull();
    expect(await getOffProduct("not-a-code", "ua")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(getOffProduct("7310865004703", "ua")).rejects.toBeInstanceOf(OffUnavailableError);
  });
});
