"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { getComplaint, getComplaintEvents } from "@/lib/data/complaints";
import { getQualityRecords } from "@/lib/data/investigation";
import { getWorkflowVersion } from "@/lib/data/workflows";
import { askClaude } from "@/lib/ai/client";
import { TABLES } from "@/lib/data/tables";

/**
 * edos.ai's first action (ARCHITECTURE.md §11/§13): summarize the case from
 * its own records. Read-only — nothing here writes to the complaint, so
 * there's no "AI Suggested, click to accept" step; the interaction itself
 * is still recorded (edoscrm_ai_interactions), because brief §27 asks for
 * every AI interaction to be auditable regardless of whether it mutates
 * anything.
 */
export async function summarizeComplaint(complaintId: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };

  const complaint = await getComplaint(complaintId);
  if (!complaint || complaint.tenant_id !== session.tenant.id) {
    return { ok: false as const, error: "That complaint could not be found." };
  }

  const [workflow, events, quality] = await Promise.all([
    getWorkflowVersion(complaint.workflow_version_id),
    getComplaintEvents(complaintId),
    getQualityRecords(complaintId),
  ]);

  const stageLabel = new Map(workflow?.definition.stages.map((s) => [s.key, s.label]) ?? []);
  const currentStage = stageLabel.get(complaint.current_stage_key) ?? complaint.current_stage_key;

  // Structured, tenant-scoped data for this one call — the system prompt
  // (lib/ai/client.ts) carries the domain grounding that's the same on
  // every call; this is what's specific to this case.
  const contextLines = [
    `Workspace: ${session.tenant.name}`,
    `Case ${complaint.case_number}: ${complaint.title}`,
    `Severity: ${complaint.severity}`,
    `Current stage: ${currentStage}`,
    complaint.description ? `Description: ${complaint.description}` : null,
    quality.investigation ? `Investigation findings: ${quality.investigation.findings}` : null,
    quality.rootCause ? `Root cause (${quality.rootCause.category}): ${quality.rootCause.description}` : null,
    quality.capa
      ? `CAPA (${quality.capa.status}): corrective — ${quality.capa.corrective_action}` +
        (quality.capa.preventive_action ? `; preventive — ${quality.capa.preventive_action}` : "")
      : null,
    `Stage history: ${events.map((e) => e.event_type).join(", ")}`,
  ].filter(Boolean);

  const prompt = [
    "Summarize this case in 3-4 short sentences for someone who has never seen it before:",
    "what happened, what's been done, what's still outstanding.",
    "",
    ...contextLines,
  ].join("\n");

  let summary: string;
  try {
    summary = await askClaude(prompt);
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "edos.ai request failed." };
  }

  const supabase = await createClient();
  await supabase.from(TABLES.aiInteractions).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaintId,
    user_id: session.user.id,
    action: "summarize_case",
    prompt,
    response: summary,
  });

  return { ok: true as const, summary };
}
