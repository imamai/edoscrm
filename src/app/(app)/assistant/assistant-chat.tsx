"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User } from "lucide-react";
import { askAssistant } from "./actions";
import { cn } from "@/lib/utils";

interface ThreadMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  evidence: { label: string }[];
  pending?: boolean;
  error?: boolean;
}

const SUGGESTIONS = [
  "What's open right now?",
  "Which complaints are breaching SLA?",
  "How many complaints came in by channel?",
  "What are our quality KPIs?",
];

let idSeq = 0;
const nextId = () => `local-${Date.now()}-${idSeq++}`;

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function AssistantChat({ tenantName }: { tenantName: string }) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;

    const userMsg: ThreadMessage = { id: nextId(), role: "user", body: q, evidence: [] };
    const placeholder: ThreadMessage = { id: nextId(), role: "assistant", body: "", evidence: [], pending: true };
    setMessages((m) => [...m, userMsg, placeholder]);
    setInput("");
    setPending(true);

    const history = messages.map((m) => ({ role: m.role, body: m.body }));
    const result = await askAssistant(q, history);

    setMessages((m) =>
      m.map((msg) =>
        msg.id === placeholder.id
          ? result.ok
            ? { ...msg, body: result.answer.body, evidence: result.answer.evidence, pending: false }
            : { ...msg, body: result.error, pending: false, error: true }
          : msg,
      ),
    );
    setPending(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[28rem] flex-col rounded-xl border border-border bg-surface">
      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sparkles className="h-8 w-8 text-brand" />
            <div>
              <p className="text-sm font-medium text-ink">Ask edos.ai about {tenantName}&rsquo;s complaints, SLAs and quality data.</p>
              <p className="mt-1 text-xs text-ink-faint">Every answer is worked from your own records — it only answers, it never acts.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-faint hover:border-brand hover:text-brand">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-brand text-white" : "bg-brand/10 text-brand")}>
                  {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                </div>
                <div className={cn("flex max-w-[80%] flex-col gap-1", m.role === "user" && "items-end")}>
                  <div className={cn("whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm", m.role === "user" ? "bg-brand text-white" : m.error ? "border border-danger/25 bg-danger/10 text-danger" : "bg-background text-ink")}>
                    {m.pending ? <Spinner className="h-4 w-4" /> : m.body}
                  </div>
                  {m.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.evidence.map((e, i) => (
                        <span key={i} className="rounded-full bg-background px-2 py-0.5 text-[0.6875rem] text-ink-faint">
                          {e.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Ask about complaints, SLAs, channels, KPIs..."
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-ink transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
