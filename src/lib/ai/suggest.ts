import "server-only";

/**
 * Complaint classification from free text (ported pattern from EDOSPMIS's
 * lib/ai/suggest.ts — the same forced-tool-call approach, verified as the
 * one structuring-extraction technique in the sibling codebase). A single
 * one-shot call, not a query loop: `tool_choice` forces this one tool, which
 * is what makes the reply reliably parse as JSON instead of asking the model
 * to emit JSON as prose and hoping.
 *
 * Recommend-only: the caller shows this as a suggestion the logger applies
 * field-by-field, never a write of its own.
 */

const API = "https://api.anthropic.com/v1/messages";
const MODEL = () => process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5-20251001";

export function modelAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export interface ComplaintSuggestion {
  category: string | null;
  severity: "T1" | "T2" | "T3" | null;
  product_name: string | null;
  sku: string | null;
  batch_number: string | null;
  reasoning: string;
}

const EXTRACT_TOOL = {
  name: "extract_complaint_details",
  description: "Return the structured complaint details found in the text, for a human to review before saving.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: ["string", "null"],
        description: "The single best-matching category name from the provided list, exactly as given — or null if none fits.",
      },
      severity: {
        type: ["string", "null"],
        enum: ["T1", "T2", "T3", null],
        description: "T1 only for a genuine safety/contamination/injury signal, T2 for a clear quality defect, T3 for anything minor or unclear. Default to null if the text gives no real signal either way.",
      },
      product_name: { type: ["string", "null"], description: "The product name mentioned, or null." },
      sku: { type: ["string", "null"], description: "A SKU/product code mentioned, or null." },
      batch_number: { type: ["string", "null"], description: "A batch/lot number mentioned, or null." },
      reasoning: { type: "string", description: "One short sentence explaining the category/severity choice, shown to the logger." },
    },
    required: ["reasoning"],
  },
};

export async function suggestComplaintDetails(freeText: string, categoryNames: string[]): Promise<ComplaintSuggestion> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("No model configured.");

  const res = await fetch(API, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: 500,
      system:
        "You extract structured complaint details from free text someone typed while logging a complaint, for a human to review and edit before saving. You never decide anything yourself and never invent facts not present in the text.",
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_complaint_details" },
      messages: [
        {
          role: "user",
          content: `Categories available: ${categoryNames.join(", ")}\n\nText:\n${freeText}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`edos.ai request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: { type: string; input?: unknown }[] };
  const toolUse = data.content?.find((block) => block.type === "tool_use");
  if (!toolUse?.input) throw new Error("edos.ai returned no structured suggestion.");

  const input = toolUse.input as Record<string, unknown>;
  return {
    category: (input.category as string) ?? null,
    severity: (input.severity as ComplaintSuggestion["severity"]) ?? null,
    product_name: (input.product_name as string) ?? null,
    sku: (input.sku as string) ?? null,
    batch_number: (input.batch_number as string) ?? null,
    reasoning: (input.reasoning as string) ?? "",
  };
}
