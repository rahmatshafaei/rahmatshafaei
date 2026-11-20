/**
 * search_foods(): ranking happens in the database before the limit, and RLS still decides which
 * foods are visible. A random token keeps the test independent of the reference data.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function newUser() {
  const client: SupabaseClient<Database> = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email: `search-${crypto.randomUUID()}@example.com`, password: "Integration-Test-123" });
  if (error || !data.user) throw error ?? new Error("signUp failed");
  return { client, id: data.user.id };
}

const T = `qx${crypto.randomUUID().replace(/[^a-f]/g, "").slice(0, 6)}`;
const macros = { kcal_per_100g: 100, protein_per_100g: 10, carbs_per_100g: 10, fat_per_100g: 2 };

describe.skipIf(!serviceKey)("search_foods", () => {
  const admin = createClient<Database>(url, serviceKey ?? "", { auth: { persistSession: false } });

  afterAll(async () => {
    await admin.from("foods").delete().is("owner_id", null).ilike("name", `%${T}%`);
  });

  it("ranks matches, own foods and verified data first, and respects RLS", async () => {
    const [a, b] = await Promise.all([newUser(), newUser()]);
    const own = (client: SupabaseClient<Database>, owner: string, name: string) =>
      client.from("foods").insert({ owner_id: owner, name, canonical_name: name.toLowerCase(), source: "user", verification: "user_entered", ...macros });
    for (const name of [`${T} hemma`, `Soppa ${T}`, `x${T}y`]) expect((await own(a.client, a.id, name)).error).toBeNull();
    expect((await own(b.client, b.id, `${T} privat`)).error).toBeNull();
    const shared = (name: string, verification: "verified" | "estimated") => ({
      owner_id: null,
      name,
      canonical_name: name.toLowerCase(),
      source: verification === "verified" ? ("livsmedelsverket" as const) : ("starter_reference" as const),
      source_ref: verification === "verified" ? `test-${name}` : null,
      verification,
      ...macros,
    });
    expect((await admin.from("foods").insert([shared(`${T} uppskattad`, "estimated"), shared(`${T} verifierad`, "verified"), shared(T, "estimated")])).error).toBeNull();

    const { data, error } = await a.client.rpc("search_foods", { p_query: T.toUpperCase(), p_limit: 20 });
    expect(error).toBeNull();
    expect(data!.map((f) => f.name)).toEqual([T, `${T} hemma`, `${T} verifierad`, `${T} uppskattad`, `Soppa ${T}`, `x${T}y`]);

    // LIKE wildcards in the query are literal characters.
    expect((await a.client.rpc("search_foods", { p_query: `${T}%`, p_limit: 20 })).data).toEqual([]);
    expect((await a.client.rpc("search_foods", { p_query: `${T.slice(0, 2)}_${T.slice(3)}`, p_limit: 20 })).data).toEqual([]);

    // Another user's private food is only visible to them.
    expect((await b.client.rpc("search_foods", { p_query: `${T} privat`, p_limit: 5 })).data!.map((f) => f.name)).toEqual([`${T} privat`]);

    // A second import of the same reference food updates it instead of duplicating it.
    const again = await admin.from("foods").insert(shared(`${T} verifierad`, "verified"));
    expect(again.error?.code).toBe("23505");
  });

  it("is not available to anonymous visitors", async () => {
    const anon = createClient<Database>(url, key, { auth: { persistSession: false } });
    expect((await anon.rpc("search_foods", { p_query: "ägg", p_limit: 5 })).error).not.toBeNull();
  });
});
