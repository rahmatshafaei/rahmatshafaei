"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction, unwrap, UserFacingError } from "@/lib/actions";
import { generateGroceryList as generate } from "@/lib/services/grocery";
import { groceryGenerateSchema, groceryItemSchema, groceryItemUpdateSchema, uuid } from "@/lib/validation";

export async function generateGroceryList(raw: unknown) {
  return authedAction(async (auth) => {
    const input = groceryGenerateSchema.parse(raw);
    const result = await generate(auth, input);
    revalidatePath("/mat/inkop");
    return result;
  });
}

export async function createEmptyList(rawName: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const name = z.string().trim().min(1, "Ange ett namn.").max(120).parse(rawName);
    const list = unwrap(await supabase.from("shopping_lists").insert({ user_id: userId, name }).select("id").single());
    revalidatePath("/mat/inkop");
    return { id: list.id };
  });
}

export async function addListItem(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = groceryItemSchema.parse(raw);
    unwrap(
      await supabase.from("shopping_list_items").insert({
        list_id: input.listId,
        user_id: userId,
        name: input.name,
        category: input.category,
        quantity: input.quantity ?? null,
        unit: input.quantity ? (input.unit ?? "st") : null,
        is_custom: true,
        position: 1000,
      }),
    );
    revalidatePath(`/mat/inkop/${input.listId}`);
    return null;
  });
}

export async function setPurchased(rawId: unknown, rawValue: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    const value = z.boolean().parse(rawValue);
    const rows = unwrap(await supabase.from("shopping_list_items").update({ is_purchased: value }).eq("id", id).eq("user_id", userId).select("list_id"));
    if (!rows.length) throw new UserFacingError("Varan hittades inte.");
    revalidatePath(`/mat/inkop/${rows[0].list_id}`);
    return null;
  });
}

export async function updateListItem(raw: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const input = groceryItemUpdateSchema.parse(raw);
    const rows = unwrap(
      await supabase
        .from("shopping_list_items")
        .update({ quantity: input.quantity ?? null, unit: input.quantity ? (input.unit ?? "g") : null, price_sek: input.priceSek ?? null, note: input.note ?? null })
        .eq("id", input.id)
        .eq("user_id", userId)
        .select("list_id"),
    );
    if (!rows.length) throw new UserFacingError("Varan hittades inte.");
    revalidatePath(`/mat/inkop/${rows[0].list_id}`);
    return null;
  });
}

export async function deleteListItem(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    unwrap(await supabase.from("shopping_list_items").delete().eq("id", id).eq("user_id", userId));
    revalidatePath("/mat/inkop", "layout");
    return null;
  });
}

export async function clearPurchased(rawListId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const listId = uuid.parse(rawListId);
    unwrap(await supabase.from("shopping_list_items").update({ is_purchased: false }).eq("list_id", listId).eq("user_id", userId));
    revalidatePath(`/mat/inkop/${listId}`);
    return null;
  });
}

export async function deleteList(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    unwrap(await supabase.from("shopping_lists").delete().eq("id", id).eq("user_id", userId));
    revalidatePath("/mat/inkop");
    return null;
  });
}
