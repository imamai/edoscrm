"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { getComplaint } from "@/lib/data/complaints";
import { getWorkflowVersion } from "@/lib/data/workflows";
import { TABLES } from "@/lib/data/tables";

/**
 * Moves a complaint to the next stage in its own pinned workflow version.
 * Deliberately just "next in the list" for now — real transition rules
 * (who can move it, required fields, conditional branches) are the workflow
 * *builder's* job (ARCHITECTURE.md §13), which stays deferred until there's
 * a second real workflow to design that UI against. The RLS policy on
 * edoscrm_complaints (complaints.manage) is what actually gates this, not
 * anything in this function — a caller without it gets a Postgres error
 * from the update below, not a silent no-op.
 */
export async function advanceStage(complaintId: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };

  const complaint = await getComplaint(complaintId);
  if (!complaint || complaint.tenant_id !== session.tenant.id) {
    return { ok: false as const, error: "That complaint could not be found." };
  }

  const workflow = await getWorkflowVersion(complaint.workflow_version_id);
  if (!workflow) return { ok: false as const, error: "This complaint's workflow could not be found." };

  const stages = workflow.definition.stages;
  const currentIndex = stages.findIndex((s) => s.key === complaint.current_stage_key);
  const nextStage = stages[currentIndex + 1];
  if (!nextStage) return { ok: false as const, error: "This complaint is already at its final stage." };

  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from(TABLES.complaints)
    .update({
      current_stage_key: nextStage.key,
      closed_at: nextStage.key === "closed" ? new Date().toISOString() : null,
    })
    .eq("id", complaintId);

  if (updateError) {
    return {
      ok: false as const,
      error: "You don't have permission to advance this complaint's stage.",
    };
  }

  await supabase.from(TABLES.complaintEvents).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaintId,
    actor_id: session.user.id,
    event_type: "stage.changed",
    payload: { from: complaint.current_stage_key, to: nextStage.key },
  });

  return { ok: true as const };
}
