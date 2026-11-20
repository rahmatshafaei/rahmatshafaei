"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, Plus, ShieldCheck, Square, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { Markdown } from "@/components/coach/markdown";
import { cn } from "@/lib/utils";
import { deleteConversation } from "./actions";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Sammanfatta min senaste vecka",
  "Hur mycket protein behöver jag för att bygga muskler?",
  "Föreslå en enkel middag runt 600 kcal",
  "Vad kan jag byta ut kyckling mot i en måltid?",
  "Hur utför jag rumänsk marklyft säkert?",
  "Hur ska jag tolka att vikten står still?",
];

const ERROR_MARKER = "[[FEL]]";

export function CoachChat({
  conversationId,
  title,
  initialMessages,
  initialPrompt,
  aiEnabled,
}: {
  conversationId: string | null;
  title?: string;
  initialMessages: Message[];
  initialPrompt?: string;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convId, setConvId] = useState(conversationId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setError(null);
    setInput("");
    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: message }, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Coachen svarar inte just nu.");
      }
      const newId = res.headers.get("X-Conversation-Id");
      if (newId && !convId) {
        setConvId(newId);
        window.history.replaceState(null, "", `/coach/${newId}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const markerAt = full.indexOf(ERROR_MARKER);
        const visible = markerAt >= 0 ? full.slice(0, markerAt).trimEnd() : full;
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: visible } : x)));
        if (markerAt >= 0) setError(full.slice(markerAt + ERROR_MARKER.length).trim());
      }
      setMessages((m) => m.filter((x) => x.id !== assistantId || x.content));
      router.refresh();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
      setMessages((m) => m.filter((x) => x.id !== assistantId || x.content));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col lg:min-h-[calc(100dvh-6rem)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-brand-ink">
          <Bot className="size-5 text-brand-ink-accent" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title ?? "AI-coach"}</h1>
          <p className="text-xs text-muted-foreground">Allmänna råd om kost och träning – inte medicinsk rådgivning.</p>
        </div>
        <Button variant="outline" size="icon" asChild className="lg:hidden">
          <Link href="/coach" aria-label="Ny konversation">
            <Plus />
          </Link>
        </Button>
        {convId ? (
          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Ta bort konversationen">
            <Trash2 />
          </Button>
        ) : null}
      </div>

      {!aiEnabled ? (
        <Notice variant="warning" title="AI-coachen är inte konfigurerad">
          Servern saknar ANTHROPIC_API_KEY. Övriga delar av FormaFit fungerar som vanligt.
        </Notice>
      ) : null}

      <div className="flex flex-1 flex-col gap-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center gap-5 py-6">
            <div className="text-center">
              <p className="text-lg font-semibold">Vad vill du ha hjälp med?</p>
              <p className="mt-1 text-sm text-muted-foreground">Coachen använder bara de delar av dina loggar som är relevanta för frågan.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  disabled={!aiEnabled}
                  onClick={() => send(s)}
                  className="rounded-2xl border bg-surface p-3 text-left text-sm transition-colors hover:border-primary/40 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden /> Coachen kan inte ändra dina planer eller ta bort data – allt sådant bekräftar du själv i appen.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", m.role === "user" ? "bg-surface-muted" : "bg-brand-ink")} aria-hidden>
                {m.role === "user" ? <UserRound className="size-4" /> : <Bot className="size-4 text-brand-ink-accent" />}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed",
                  m.role === "user" ? "rounded-tr-lg bg-primary-strong text-primary-foreground" : "rounded-tl-lg border bg-surface shadow-[var(--shadow-card)]",
                )}
              >
                <span className="sr-only">{m.role === "user" ? "Du:" : "Coachen:"}</span>
                {m.role === "assistant" ? (
                  m.content ? (
                    <Markdown text={m.content} />
                  ) : (
                    <span className="inline-flex gap-1" aria-label="Coachen skriver">
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60" />
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:120ms]" />
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:240ms]" />
                    </span>
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        {error ? <Notice variant="danger">{error}</Notice> : null}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-4 flex items-end gap-2 rounded-3xl border bg-surface p-2 shadow-[var(--shadow-float)] lg:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          rows={1}
          aria-label="Meddelande till coachen"
          placeholder={aiEnabled ? "Skriv en fråga…" : "AI är inte tillgängligt"}
          disabled={!aiEnabled}
          value={input}
          maxLength={4000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          className="max-h-40 min-h-11 resize-none border-0 focus:ring-0"
        />
        {streaming ? (
          <Button type="button" size="icon" variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="Avbryt svaret">
            <Square />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim() || !aiEnabled} aria-label="Skicka">
            <ArrowUp />
          </Button>
        )}
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Ta bort konversationen?"
        description="Konversationen och dess historik raderas permanent."
        confirmLabel="Ta bort"
        onConfirm={async () => {
          if (!convId) return;
          const res = await deleteConversation(convId);
          if (!res.ok) return void toast.error(res.error);
          router.push("/coach");
          router.refresh();
        }}
      />
    </div>
  );
}
