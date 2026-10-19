import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { isAiConfigured } from "@/lib/env";
import { uuid } from "@/lib/validation";
import { CoachChat } from "../coach-chat";

export const metadata: Metadata = { title: "AI-coach" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const auth = await requireAuth();
  const { data: conversation } = await auth.supabase.from("ai_conversations").select("id, title").eq("id", id).eq("user_id", auth.userId).maybeSingle();
  if (!conversation) notFound();
  const { data: messages } = await auth.supabase.from("ai_messages").select("id, role, content").eq("conversation_id", id).order("created_at");
  return <CoachChat key={id} conversationId={id} title={conversation.title} initialMessages={messages ?? []} aiEnabled={isAiConfigured()} />;
}
