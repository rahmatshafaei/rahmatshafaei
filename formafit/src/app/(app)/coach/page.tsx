import type { Metadata } from "next";
import { isAiConfigured } from "@/lib/env";
import { CoachChat } from "./coach-chat";

export const metadata: Metadata = { title: "AI-coach" };

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ fraga?: string }> }) {
  const { fraga } = await searchParams;
  return <CoachChat conversationId={null} initialMessages={[]} initialPrompt={fraga?.slice(0, 500)} aiEnabled={isAiConfigured()} />;
}
