import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { uuid } from "@/lib/validation";
import { ShoppingList } from "./shopping-list";

export const metadata: Metadata = { title: "Inköpslista" };

export default async function ShoppingListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const auth = await requireAuth();
  const [{ data: list }, { data: items }] = await Promise.all([
    auth.supabase.from("shopping_lists").select("*, meal_plans(name)").eq("id", id).eq("user_id", auth.userId).maybeSingle(),
    auth.supabase.from("shopping_list_items").select("*").eq("list_id", id).eq("user_id", auth.userId).order("position").order("name"),
  ]);
  if (!list) notFound();
  return <ShoppingList list={list} items={items ?? []} planName={list.meal_plans?.name ?? null} />;
}
