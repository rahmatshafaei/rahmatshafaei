import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { AuthContext } from "@/lib/auth";
import { addDays, isoDateOf, todayIso } from "@/lib/dates";
import { getIntakeRange } from "@/lib/data/diary";
import { EXPERIENCE_LABELS, GOAL_LABELS } from "@/lib/labels";
import { ALLERGENS, DIET_PREFERENCES } from "@/lib/nutrition/allergens";
import { buildContextText, relevantTopics, type CoachData } from "./coach-context";

/** Builds the minimal context for one coach turn. */
export async function loadCoachContext(auth: AuthContext, message: string) {
  const [{ data: profile }, { data: targets }, { data: prefs }] = await Promise.all([
    auth.supabase.from("profiles").select("goal, experience, allergies, diet_preferences").eq("id", auth.userId).single(),
    auth.supabase.from("nutrition_targets").select("calories, protein_g, carbs_g, fat_g").eq("user_id", auth.userId).maybeSingle(),
    auth.supabase.from("user_preferences").select("ai_share_logs").eq("user_id", auth.userId).single(),
  ]);
  const shareLogs = prefs?.ai_share_logs ?? false;
  const topics = shareLogs ? relevantTopics(message) : [];
  const today = todayIso();
  const data: CoachData = {};

  await Promise.all(
    topics.map(async (topic) => {
      if (topic === "nutrition") {
        const days = await getIntakeRange(auth, addDays(today, -6), today);
        const logged = days.filter((d) => d.kcal > 0);
        data.nutrition = {
          days: 7,
          loggedDays: logged.length,
          avgKcal: logged.length ? logged.reduce((s, d) => s + d.kcal, 0) / logged.length : null,
          avgProtein: logged.length ? logged.reduce((s, d) => s + d.protein, 0) / logged.length : null,
        };
      }
      if (topic === "training") {
        const [{ data: sessions }, { data: program }] = await Promise.all([
          auth.supabase
            .from("workout_sessions")
            .select("name, completed_at, session_sets(is_completed)")
            .eq("user_id", auth.userId)
            .eq("status", "completed")
            .gte("completed_at", `${addDays(today, -28)}T00:00:00Z`)
            .order("completed_at", { ascending: false })
            .limit(12),
          auth.supabase.from("workout_programs").select("name").eq("user_id", auth.userId).eq("is_active", true).maybeSingle(),
        ]);
        data.training = {
          activeProgram: program?.name ?? null,
          sessions: (sessions ?? []).map((s) => ({ date: isoDateOf(s.completed_at!), name: s.name, sets: s.session_sets.filter((x) => x.is_completed).length })),
        };
      }
      if (topic === "progress") {
        const { data: weights } = await auth.supabase
          .from("measurements")
          .select("measured_on, weight_kg")
          .eq("user_id", auth.userId)
          .not("weight_kg", "is", null)
          .gte("measured_on", addDays(today, -42))
          .order("measured_on");
        data.progress = { weights: (weights ?? []).map((w) => ({ date: w.measured_on, weightKg: Number(w.weight_kg) })) };
      }
    }),
  );

  const text = buildContextText(
    {
      goal: profile?.goal ? GOAL_LABELS[profile.goal] : null,
      experience: profile?.experience ? EXPERIENCE_LABELS[profile.experience] : null,
      allergies: (profile?.allergies ?? []).map((a) => ALLERGENS[a as keyof typeof ALLERGENS] ?? a),
      dietPreferences: (profile?.diet_preferences ?? []).map((d) => DIET_PREFERENCES[d as keyof typeof DIET_PREFERENCES] ?? d),
      targets: targets ? { calories: targets.calories, protein_g: Number(targets.protein_g), carbs_g: Number(targets.carbs_g), fat_g: Number(targets.fat_g) } : null,
    },
    data,
    shareLogs,
  );
  return { text, topics, shareLogs, today };
}

/** Conversation history in API format, oldest first, capped to recent turns. */
export function toMessageParams(history: { role: "user" | "assistant"; content: string }[], limit = 20): Anthropic.Beta.BetaMessageParam[] {
  const recent = history.slice(-limit);
  // The API requires the first message to be from the user.
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent.map((m) => ({ role: m.role, content: m.content }));
}
