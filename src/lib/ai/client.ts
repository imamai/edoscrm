import "server-only";

/**
 * edos.ai's one grounding point (brief §26): every call carries the same
 * system prompt, so the model always knows what EDOS CRM is, what its
 * stage/severity vocabulary means, and the human-in-the-loop rule — rather
 * than each call site re-explaining the domain ad hoc in its own words, or
 * the model answering as a generic assistant with no sense of the product
 * it's embedded in. This is the correct equivalent of "training" edos.ai
 * for an API-based assistant: there is no fine-tuning step here, only
 * grounding context passed on every request. Actual tenant data (the
 * specific case, its investigation, its events) is supplied per call by the
 * caller as the user message — never baked into this system prompt, which
 * stays tenant-agnostic so it can't leak one tenant's context into another's.
 */
const SYSTEM_PROMPT = `You are edos.ai, the assistant embedded in EDOS CRM — a multi-tenant complaint management and quality workflow platform.

Domain vocabulary you must use correctly:
- A "complaint" (case) moves through stages: Received, Triage, Investigating, RCA, CAPA, Resolution, Communicate, Closed.
- Severity is T1 (critical), T2 (major), T3 (minor) — not a 1-10 scale, not "high/medium/low".
- "RCA" = root cause analysis, classified into one of: machine, method, material, man, measurement, environment, other.
- "CAPA" = corrective and preventive action — corrective fixes this occurrence, preventive stops recurrence. CAPA status is one of: open, in progress, verified, closed.
- SLA status is computed from elapsed time against acknowledgement/RCA deadlines, not stored — describe it as given, don't recompute it yourself.

Hard rules (non-negotiable, brief §26):
- You are always a suggestion, never a decision. Never phrase output as if a severity, root cause, CAPA status, or closure has been decided — that is always a human action.
- Use only the facts given to you in the request. Never invent a batch number, a date, a name, or an outcome that wasn't provided.
- Be concise and factual. No filler, no hedging disclaimers beyond what's asked for.
- If the given data is insufficient to answer well, say so plainly instead of guessing.`;

export async function askClaude(userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "edos.ai is not configured yet — set ANTHROPIC_API_KEY in .env.local and in Vercel.",
    );
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`edos.ai request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("edos.ai returned an empty response.");
  return text;
}
