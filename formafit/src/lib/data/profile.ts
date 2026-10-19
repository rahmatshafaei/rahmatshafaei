import "server-only";
import { cache } from "react";
import type { AuthContext } from "@/lib/auth";

export const getProfile = cache(async ({ supabase, userId }: AuthContext) => {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
});

export const getTargets = cache(async ({ supabase, userId }: AuthContext) => {
  const { data, error } = await supabase.from("nutrition_targets").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
});

export const getPreferences = cache(async ({ supabase, userId }: AuthContext) => {
  const { data, error } = await supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
});

export async function getLatestWeight({ supabase, userId }: AuthContext): Promise<number | null> {
  const { data } = await supabase
    .from("measurements")
    .select("weight_kg")
    .eq("user_id", userId)
    .not("weight_kg", "is", null)
    .order("measured_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.weight_kg ?? null;
}
