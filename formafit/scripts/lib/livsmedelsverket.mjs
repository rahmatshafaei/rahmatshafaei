/**
 * Mapping from Livsmedelsverket's food database API (Livsmedelsdatabasen, CC BY 4.0) to FormaFit's
 * `foods` table. Nutrition values are copied as published, never adjusted; a food whose values
 * do not fit the table's constraints is skipped and reported instead of being changed.
 *
 * API: https://dataportal.livsmedelsverket.se/livsmedel/swagger/v1/swagger.json
 */

export const API_BASE = "https://dataportal.livsmedelsverket.se/livsmedel/api/v1";
export const LICENSE = "CC BY 4.0";
export const DOCS_URL = "https://www.livsmedelsverket.se/om-oss/psidata/livsmedelsdatabasen";

/**
 * @typedef {{ namn?: string | null, euroFIRkod?: string | null, varde?: number | null, enhet?: string | null }} Naringsvarde
 * @typedef {{ nummer: number, namn?: string | null, version?: string | null, tillagningsmetod?: string | null }} Livsmedel
 */

const round2 = (v) => Math.round(v * 100) / 100;

/** Finds one nutrient by EuroFIR code (and unit, for energy which is given in both kJ and kcal). */
function nutrient(values, code, unit) {
  const hit = values.find(
    (v) => v?.euroFIRkod === code && (!unit || (v.enhet ?? "").toLowerCase() === unit) && typeof v.varde === "number" && Number.isFinite(v.varde),
  );
  return hit ? hit.varde : null;
}

/**
 * Energy and macronutrients per 100 g. Carbohydrates are "Kolhydrater, tillgängliga" (CHO). Energy
 * uses the published kcal value; if only kJ is published it is converted with the factor 0.239
 * that Livsmedelsverket itself uses. A missing nutrient stays null (unknown), never 0.
 * @param {Naringsvarde[]} values
 */
export function extractMacros(values) {
  const kcal = nutrient(values, "ENERC", "kcal");
  const kj = kcal === null ? nutrient(values, "ENERC", "kj") : null;
  const pick = (code) => {
    const v = nutrient(values, code);
    return v === null ? null : round2(v);
  };
  return {
    kcal: kcal !== null ? round2(kcal) : kj !== null ? round2(kj * 0.239) : null,
    protein: pick("PROT"),
    carbs: pick("CHO"),
    fat: pick("FAT"),
    fiber: pick("FIBT"),
  };
}

const words = (name) => name.toLocaleLowerCase("sv-SE").split(/[^a-zåäöéü]+/u).filter(Boolean);

// Grocery sections, used only to group shopping lists. A stem matches the start or end of a word,
// because Swedish compounds put the main noun last ("hårdost", "laxfilé"); stems marked "=" must
// be the whole word ("Nöt talg" is beef, "cashewnöt" is not). First match wins.
const CATEGORY_RULES = [
  ["meat_fish", ["=nöt", "kalv", "gris", "fläsk", "kyckling", "kalkon", "höna", "anka", "lamm", "=får", "vilt", "älg", "=ren", "hjort", "rådjur", "korv", "skinka", "bacon", "färs", "köttbull", "kött", "lever", "blodpudding", "fisk", "lax", "torsk", "sill", "strömming", "makrill", "tonfisk", "sej", "kolja", "abborre", "gös", "rödspätta", "röding", "öring", "ansjovis", "kaviar", "räk", "krabb", "hummer", "kräft", "mussl", "ostron", "bläckfisk"]],
  ["dairy", ["mjölk", "filmjölk", "=fil", "yoghurt", "ost", "grädd", "smör", "kvarg", "keso", "kesella", "crème", "creme", "ägg", "mesost", "messmör", "kefir", "kärnmjölk"]],
  ["grains", ["bröd", "mjöl", "gryn", "havre", "ris", "pasta", "makaron", "spaghetti", "nudl", "müsli", "musli", "flingor", "knäcke", "råg", "vete", "korn", "bulgur", "couscous", "quinoa", "hirs", "matvete", "dinkel", "tortilla", "polenta"]],
  ["produce", ["äpple", "päron", "banan", "apelsin", "citron", "lime", "grapefrukt", "mandarin", "clementin", "jordgubb", "hallon", "blåbär", "lingon", "vinbär", "krusbär", "körsbär", "bär", "tomat", "gurka", "sallad", "kål", "morot", "morötter", "lök", "purjo", "vitlök", "potatis", "paprika", "broccoli", "blomkål", "spenat", "svamp", "champinjon", "kantarell", "avokado", "druv", "melon", "ananas", "kiwi", "mango", "persika", "nektarin", "plommon", "aprikos", "fikon", "dadl", "rädis", "rödbet", "selleri", "zucchini", "squash", "aubergine", "majs", "sparris", "ärt", "bönor", "böna", "linser", "kikärt", "rova", "palsternack", "pumpa", "ingefära", "örter", "persilja", "dill", "basilika", "frukt", "grönsak"]],
  ["pantry", ["olja", "socker", "sirap", "honung", "salt", "krydd", "buljong", "fond", "sås", "ketchup", "senap", "majonnäs", "dressing", "nöt", "nötter", "mandl", "mandel", "frö", "frön", "jordnöt", "sylt", "marmelad", "choklad", "kakao", "kaffe", "vinäger", "bakpulver", "jäst", "gelatin", "konserv", "=te"]],
];

/**
 * @param {string} name
 * @returns {"meat_fish" | "dairy" | "grains" | "produce" | "pantry" | "other"}
 */
export function categoryFor(name) {
  const ws = words(name);
  for (const [category, stems] of CATEGORY_RULES) {
    const hit = (w) =>
      stems.some((s) => (s.startsWith("=") ? w === s.slice(1) : w === s || w.startsWith(s) || w.endsWith(s)));
    if (ws.some(hit)) return category;
  }
  return "other";
}

const COOKED = /^(kokt|kokta|stekt|stekta|ugnsstekt|ugnsbakad|ugnsbakade|grillad|grillade|grillat|friterad|friterade|bakad|bakade|ångkokt|tillagad|tillagade|rökt|rökta|gräddad|gräddade|halstrad|wokad|panerad)$/u;
const RAW = /^(rå|råa|rått|okokt|okokta|färsk|färska)$/u;
const DRIED = /^(torkad|torkade|torkat|torr|torra)$/u;

/**
 * @param {string} name
 * @param {string | null | undefined} method Livsmedelsverket's `tillagningsmetod`, when given.
 * @returns {"raw" | "cooked" | "dried" | "as_sold"}
 */
export function preparationFor(name, method) {
  const ws = [...words(method ?? ""), ...words(name)];
  if (ws.some((w) => DRIED.test(w))) return "dried";
  if (ws.some((w) => COOKED.test(w))) return "cooked";
  if (ws.some((w) => RAW.test(w))) return "raw";
  return "as_sold";
}

/** Reasons a food cannot be stored as published (the table's check constraints). */
function invalidReason(m) {
  if (m.kcal !== null && (m.kcal < 0 || m.kcal > 950)) return `energi ${m.kcal} kcal utanför 0–950`;
  for (const [k, v] of [["protein", m.protein], ["kolhydrater", m.carbs], ["fett", m.fat], ["fiber", m.fiber]]) {
    if (v !== null && (v < 0 || v > 100)) return `${k} ${v} g utanför 0–100`;
  }
  const sum = (m.protein ?? 0) + (m.carbs ?? 0) + (m.fat ?? 0);
  if (sum > 100.5) return `protein + kolhydrater + fett = ${round2(sum)} g > 100,5 g`;
  if (m.kcal === null && m.protein === null && m.carbs === null && m.fat === null) return "inga näringsvärden";
  return null;
}

/**
 * @param {Livsmedel} food
 * @param {Naringsvarde[]} values
 * @returns {{ row: Record<string, unknown> } | { skip: string }}
 */
export function toFoodRow(food, values) {
  const name = (food.namn ?? "").trim();
  if (!Number.isInteger(food.nummer) || !name) return { skip: "saknar nummer eller namn" };
  if (name.length > 200) return { skip: "namnet är för långt" };
  const m = extractMacros(values);
  const reason = invalidReason(m);
  if (reason) return { skip: reason };
  const updated = food.version ? String(food.version).slice(0, 10) : null;
  return {
    row: {
      name,
      canonical_name: name.toLocaleLowerCase("sv-SE"),
      category: categoryFor(name),
      preparation: preparationFor(name, food.tillagningsmetod),
      kcal_per_100g: m.kcal,
      protein_per_100g: m.protein,
      carbs_per_100g: m.carbs,
      fat_per_100g: m.fat,
      fiber_per_100g: m.fiber,
      source_ref: String(food.nummer),
      source_note: `Källa: Livsmedelsverkets livsmedelsdatabas, livsmedelsnummer ${food.nummer}${updated ? ` (uppdaterad ${updated})` : ""}. Licens: ${LICENSE}.`,
    },
  };
}

const sqlText = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const sqlNum = (v) => (v === null || v === undefined ? "null" : String(v));

/**
 * The migration that inserts or updates the shared reference foods. Allergen data is not part of
 * the database, so allergens are marked as unknown rather than as absent.
 * @param {Record<string, any>[]} rows
 * @param {{ retrievedOn: string, apiVersion?: string | null, skipped: { nummer: number, namn?: string | null, reason: string }[] }} meta
 */
export function toMigrationSql(rows, meta) {
  const sorted = [...rows].sort((a, b) => Number(a.source_ref) - Number(b.source_ref));
  const values = sorted.map(
    (r) =>
      `  (null, ${sqlText(r.name)}, ${sqlText(r.canonical_name)}, '${r.category}', '${r.preparation}', ${sqlNum(r.kcal_per_100g)}, ${sqlNum(r.protein_per_100g)}, ${sqlNum(r.carbs_per_100g)}, ${sqlNum(r.fat_per_100g)}, ${sqlNum(r.fiber_per_100g)}, '{}', false, '{}', 'livsmedelsverket', ${sqlText(r.source_ref)}, ${sqlText(r.source_note)}, 'verified')`,
  );
  const skipped = meta.skipped.length
    ? meta.skipped.map((s) => `--   ${s.nummer} ${String(s.namn ?? "").replace(/\s+/g, " ")}: ${s.reason}`).join("\n")
    : "--   (inga)";
  return `-- Generated by scripts/import-livsmedelsverket.mjs. Do not edit by hand; run the script again.
--
-- Source: Livsmedelsverkets livsmedelsdatabas (${DOCS_URL}),
-- licensed under ${LICENSE} (https://creativecommons.org/licenses/by/4.0/deed.sv).
-- Retrieved ${meta.retrievedOn}${meta.apiVersion ? ` via API ${meta.apiVersion}` : ""}: ${sorted.length} foods.
-- Values are copied as published (per 100 g edible part). Allergens are not part of the
-- database, so they are stored as unknown.
--
-- Skipped because the published values do not fit the table's constraints:
${skipped}

insert into public.foods (
  owner_id, name, canonical_name, category, preparation,
  kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
  allergens, allergens_known, diet_tags, source, source_ref, source_note, verification
)
values
${values.join(",\n")}
on conflict (source, source_ref) where owner_id is null and source_ref is not null
do update set
  name = excluded.name,
  canonical_name = excluded.canonical_name,
  category = excluded.category,
  preparation = excluded.preparation,
  kcal_per_100g = excluded.kcal_per_100g,
  protein_per_100g = excluded.protein_per_100g,
  carbs_per_100g = excluded.carbs_per_100g,
  fat_per_100g = excluded.fat_per_100g,
  fiber_per_100g = excluded.fiber_per_100g,
  source_note = excluded.source_note,
  verification = excluded.verification,
  is_archived = false;
`;
}
