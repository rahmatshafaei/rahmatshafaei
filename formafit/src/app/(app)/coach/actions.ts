"use server";
import { revalidatePath } from "next/cache";
import { authedAction, unwrap } from "@/lib/actions";
import { uuid } from "@/lib/validation";

export async function deleteConversation(rawId: unknown) {
  return authedAction(async ({ supabase, userId }) => {
    const id = uuid.parse(rawId);
    unwrap(await supabase.from("ai_conversations").delete().eq("id", id).eq("user_id", userId));
    revalidatePath("/coach", "layout");
    return null;
  });
}
