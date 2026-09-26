"use server";

import { resolveSession } from "@/lib/data/session";
import { createToolContext } from "@/lib/ai/tools";
import { answerWithModel, modelAvailable, type Answer } from "@/lib/ai/llm";

export type AskResult = { ok: true; answer: Answer } | { ok: false; error: string };

/**
 * Answer-only, on purpose: no conversation is persisted (unlike EDOSPMIS's
 * assistant, which saves a history sidebar) — the brief for this one was
 * explicitly "just answer questions about the data, nothing more". History
 * for a follow-up question still works within one open chat, carried as
 * plain state in assistant-chat.tsx; it just doesn't survive a reload.
 */
export async function askAssistant(question: string, history: { role: "user" | "assistant"; body: string }[] = []): Promise<AskResult> {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false, error: "Your session has expired." };

  const q = question.trim();
  if (!q) return { ok: false, error: "Type a question first." };
  if (q.length > 500) return { ok: false, error: "That question is too long — keep it under 500 characters." };

  if (!modelAvailable()) {
    return { ok: false, error: "edos.ai needs an ANTHROPIC_API_KEY configured for this workspace to answer questions. In the meantime, Reports and Analytics cover the same data." };
  }

  const earlier = history.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.body === "string").slice(-8).map((m) => ({ role: m.role, body: m.body.slice(0, 2000) }));

  const ctx = createToolContext(session.tenant.id);

  try {
    const answer = await answerWithModel(q, earlier, ctx, session.tenant.name);
    return { ok: true, answer };
  } catch (cause) {
    console.error("edoscrm: edos.ai request failed", cause);
    return { ok: false, error: "edos.ai couldn't answer that just now — try again in a moment." };
  }
}
