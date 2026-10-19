/**
 * Grocery list aggregation.
 *
 * Planned ingredients are grouped by a normalised identity:
 *   (canonical food name, preparation state, unit)
 * Quantities are only summed inside a group. Different units are never combined and
 * raw/cooked/dried versions of the same food stay separate items, because their weights
 * are not interchangeable.
 */

export type GroceryCategory = "meat_fish" | "dairy" | "grains" | "produce" | "pantry" | "other";
export type Preparation = "raw" | "cooked" | "dried" | "as_sold";
export type GroceryUnit = "g" | "ml" | "st" | "förp";

export const GROCERY_CATEGORIES: { key: GroceryCategory; label: string }[] = [
  { key: "meat_fish", label: "Kött och fisk" },
  { key: "dairy", label: "Mejeri och alternativ" },
  { key: "grains", label: "Spannmål och pasta" },
  { key: "produce", label: "Frukt och grönt" },
  { key: "pantry", label: "Skafferi" },
  { key: "other", label: "Övrigt" },
];

export const PREPARATION_LABELS: Record<Preparation, string> = {
  raw: "rå vikt",
  cooked: "tillagad vikt",
  dried: "torr vikt",
  as_sold: "",
};

export interface GrocerySourceItem {
  foodId: string | null;
  name: string;
  canonicalName?: string | null;
  category: GroceryCategory;
  preparation: Preparation | null;
  quantity: number;
  unit: GroceryUnit;
}

export interface AggregatedGroceryItem {
  key: string;
  foodIds: string[];
  name: string;
  category: GroceryCategory;
  preparation: Preparation | null;
  quantity: number;
  unit: GroceryUnit;
  occurrences: number;
}

/** Lowercase, Unicode-normalised, single-spaced identity string (keeps å, ä, ö). */
export function normalizeIdentity(name: string): string {
  return name
    .normalize("NFC")
    .toLocaleLowerCase("sv-SE")
    .replace(/[,.;:()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function groceryKey(item: Pick<GrocerySourceItem, "name" | "canonicalName" | "preparation" | "unit">): string {
  const identity = normalizeIdentity(item.canonicalName || item.name);
  return `${identity}|${item.preparation ?? "as_sold"}|${item.unit}`;
}

export function aggregateGroceries(items: readonly GrocerySourceItem[]): AggregatedGroceryItem[] {
  const groups = new Map<string, AggregatedGroceryItem>();
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
    const key = groceryKey(item);
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.occurrences += 1;
      if (item.foodId && !existing.foodIds.includes(item.foodId)) existing.foodIds.push(item.foodId);
    } else {
      groups.set(key, {
        key,
        foodIds: item.foodId ? [item.foodId] : [],
        name: item.name,
        category: item.category,
        preparation: item.preparation,
        quantity: item.quantity,
        unit: item.unit,
        occurrences: 1,
      });
    }
  }
  const order = new Map(GROCERY_CATEGORIES.map((c, i) => [c.key, i]));
  return [...groups.values()]
    .map((g) => ({ ...g, quantity: roundShoppingQuantity(g.quantity, g.unit) }))
    .sort(
      (a, b) =>
        (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99) || a.name.localeCompare(b.name, "sv-SE"),
    );
}

/** Shopping quantities are rounded up so the list never asks for less than the plan needs. */
export function roundShoppingQuantity(quantity: number, unit: GroceryUnit): number {
  if (unit === "g" || unit === "ml") {
    // Floating point sums such as 0.1 + 0.2 must not round up a whole gram.
    return Math.ceil(Math.round(quantity * 1000) / 1000);
  }
  return Math.ceil(quantity - 1e-9);
}

export function groupByCategory<T extends { category: GroceryCategory }>(items: readonly T[]) {
  return GROCERY_CATEGORIES.map((c) => ({ ...c, items: items.filter((i) => i.category === c.key) })).filter(
    (g) => g.items.length > 0,
  );
}

/** Plain-text version of a list for sharing / copying. */
export function groceryListToText(
  title: string,
  items: readonly { name: string; category: GroceryCategory; quantity: number | null; unit: string | null; is_purchased?: boolean; preparation?: Preparation | null }[],
): string {
  const lines = [title, ""];
  for (const group of groupByCategory(items)) {
    lines.push(group.label);
    for (const item of group.items) {
      const qty = item.quantity ? ` – ${formatQuantity(item.quantity, item.unit)}` : "";
      const prep = item.preparation && PREPARATION_LABELS[item.preparation] ? ` (${PREPARATION_LABELS[item.preparation]})` : "";
      lines.push(`${item.is_purchased ? "[x]" : "[ ]"} ${item.name}${prep}${qty}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function formatQuantity(quantity: number, unit: string | null): string {
  if (unit === "g" && quantity >= 1000) {
    return `${(quantity / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} kg`;
  }
  if (unit === "ml" && quantity >= 1000) {
    return `${(quantity / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} l`;
  }
  return `${quantity.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} ${unit ?? ""}`.trim();
}
