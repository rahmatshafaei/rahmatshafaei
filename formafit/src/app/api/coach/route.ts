import { NextResponse, type NextRequest } from "next/server";
import { UserFacingError } from "@/lib/actions";
import { getAuth } from "@/lib/auth";
import { aiErrorMessage, aiModel, FALLBACK_BETA, getAnthropic } from "@/lib/ai/client";
import { COACH_SYSTEM_PROMPT } from "@/lib/ai/coach-context";
import { loadCoachContext, toMessageParams } from "@/lib/ai/coach";
import { consumeAiQuota } from "@/lib/ai/rate-limit";
import { chatMessageSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Streams one coach reply as plain text. The user message is stored before the model call
 * and the assistant reply after it completes, so history survives reloads.
 */
export async function POST(request: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Du måste vara inloggad." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { message } = parsed.data;

  let anthropic;
  try {
    anthropic = getAnthropic();
    await consumeAiQuota(auth, "coach");
  } catch (e) {
    const status = e instanceof UserFacingError && e.message.includes("gränsen") ? 429 : 503;
    return NextResponse.json({ error: aiErrorMessage(e) }, { status });
  }

  // Load or create the conversation (ownership enforced by RLS and the user_id filter).
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const { data } = await auth.supabase.from("ai_conversations").select("id").eq("id", conversationId).eq("user_id", auth.userId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Konversationen hittades inte." }, { status: 404 });
  } else {
    const title = message.length > 60 ? `${message.slice(0, 57)}…` : message;
    const { data, error } = await auth.supabase.from("ai_conversations").insert({ user_id: auth.userId, title }).select("id").single();
    if (error) return NextResponse.json({ error: "Det gick inte att starta en konversation." }, { status: 500 });
    conversationId = data.id;
  }

  const { data: history } = await auth.supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);
  const { error: insertError } = await auth.supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, user_id: auth.userId, role: "user", content: message });
  if (insertError) return NextResponse.json({ error: "Meddelandet kunde inte sparas." }, { status: 500 });

  const context = await loadCoachContext(auth, message);
  const messages = [...toMessageParams([...(history ?? [])].reverse()), { role: "user" as const, content: message }];
  const encoder = new TextEncoder();
  const convId = conversationId;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      try {
        const response = anthropic.beta.messages.stream({
          model: aiModel(),
          max_tokens: 4000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          output_config: { effort: "low" },
          system: [
            { type: "text", text: COACH_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
            { type: "text", text: `Dagens datum: ${context.today}.\n${context.text}` },
          ],
          messages,
        });
        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await response.finalMessage();
        if (final.stop_reason === "refusal" && !text) {
          text = "Jag kan tyvärr inte hjälpa till med den frågan. Prova att formulera om den.";
          controller.enqueue(encoder.encode(text));
        }
        if (text.trim()) {
          await auth.supabase.from("ai_messages").insert({
            conversation_id: convId,
            user_id: auth.userId,
            role: "assistant",
            content: text.slice(0, 20000),
            meta: { topics: context.topics, stop_reason: final.stop_reason },
          });
          await auth.supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
        }
      } catch (e) {
        console.error("[coach] stream failed", e instanceof Error ? e.message : e);
        controller.enqueue(encoder.encode(`\n\n[[FEL]] ${aiErrorMessage(e)}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": convId,
    },
  });
}
