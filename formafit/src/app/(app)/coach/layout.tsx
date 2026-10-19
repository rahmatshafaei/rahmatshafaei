import Link from "next/link";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const { data } = await auth.supabase.from("ai_conversations").select("id, title, updated_at").eq("user_id", auth.userId).order("updated_at", { ascending: false }).limit(30);
  const conversations = data ?? [];
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="hidden flex-col gap-2 lg:flex">
        <Button asChild>
          <Link href="/coach">
            <Plus /> Ny konversation
          </Link>
        </Button>
        <nav aria-label="Tidigare konversationer" className="mt-2 flex flex-col gap-1">
          {conversations.map((c) => (
            <Link key={c.id} href={`/coach/${c.id}`} className="rounded-xl px-3 py-2 text-sm hover:bg-surface-muted">
              <span className="block truncate">{c.title}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(c.updated_at)}</span>
            </Link>
          ))}
          {!conversations.length ? (
            <p className="flex items-center gap-2 px-3 text-sm text-muted-foreground">
              <Bot className="size-4" /> Inga konversationer ännu
            </p>
          ) : null}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
