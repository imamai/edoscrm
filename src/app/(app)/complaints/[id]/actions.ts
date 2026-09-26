"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getComplaint, getBatchSiblings, type Severity } from "@/lib/data/complaints";
import { getWorkflowVersion } from "@/lib/data/workflows";
import { getQualityRecords } from "@/lib/data/investigation";
import { computeBatchEscalation } from "@/lib/domain/escalation";
import { notifyUsers } from "@/lib/data/notifications";
import { informComplainantOfClosure } from "@/lib/notify/complainant";
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

  // Brief §6 "Closure control": closing is its own gated action
  // (closeComplaint below), not just another stage in the list — moving
  // here would let a case close with no CAPA verification and no written
  // confirmation on file.
  if (nextStage.key === "closed") {
    return { ok: false as const, error: "Use the closure action once corrective action is confirmed — a case can't be closed as a plain stage move." };
  }

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

/** Brief §6 "Assignment and ownership" — assignee_id has existed on the
 * schema since Phase 3 but nothing ever wrote to it. RLS's
 * `complaints.manage` requirement on the update is the real gate; the
 * `complaints.assign` check here just gives a clean error first. */
export async function assignComplaint(complaintId: string, assigneeId: string | null) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "complaints.assign"))) {
    return { ok: false as const, error: "You don't have permission to assign complaints." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.complaints).update({ assignee_id: assigneeId }).eq("id", complaintId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from(TABLES.complaintEvents).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaintId,
    actor_id: session.user.id,
    event_type: "assignment.changed",
    payload: { assignee_id: assigneeId },
  });

  if (assigneeId) await notifyUsers(session.tenant.id, [assigneeId], "A complaint was assigned to you", complaintId);

  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true as const };
}

/** Brief §6 "Triage": severity is system-suggested at creation but stays
 * reviewable — every override needs a recorded reason (§9 business rule),
 * kept on the complaint itself and in the event log. */
export async function overrideSeverity(complaintId: string, severity: Severity, reason: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!reason.trim()) return { ok: false as const, error: "Say why the severity is changing." };
  if (!(await hasPermission(session.tenant.id, "complaints.severity.override"))) {
    return { ok: false as const, error: "You don't have permission to override severity." };
  }

  const complaint = await getComplaint(complaintId);
  if (!complaint) return { ok: false as const, error: "That complaint could not be found." };

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.complaints)
    .update({ severity, severity_override_reason: reason.trim() })
    .eq("id", complaintId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from(TABLES.complaintEvents).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaintId,
    actor_id: session.user.id,
    event_type: "severity.changed",
    payload: { from: complaint.severity, to: severity, reason: reason.trim() },
  });

  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true as const };
}

/** The brief's missing "Pending Information" status (§6 "Status tracking"),
 * built as a cross-cutting flag rather than a stage rename — see migration
 * 0012's own note on why. */
export async function setPendingInformation(complaintId: string, pending: boolean, reason: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "complaints.manage"))) {
    return { ok: false as const, error: "You don't have permission to update this complaint." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.complaints)
    .update({ pending_information: pending, pending_information_reason: pending ? reason.trim() || null : null })
    .eq("id", complaintId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from(TABLES.complaintEvents).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaintId,
    actor_id: session.user.id,
    event_type: pending ? "pending_information.set" : "pending_information.cleared",
    payload: { reason: reason.trim() || null },
  });

  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true as const };
}

/**
 * Brief §6 "Closure control": no case closes without a CAPA that's been
 * verified and a written confirmation on file — both checked here, not just
 * left to the UI to enforce, since RLS alone can't express "and a related row
 * in another table is in this state".
 *
 * The brief's closure criterion has a second half that used to be unenforced:
 * "and the complainant is informed". A case with an email address on file now
 * needs an outcome message, which is sent and recorded as the closing
 * communication. Without that half, the closed-loop KPI measured internal
 * paperwork rather than accountability to the person who complained — it could
 * read 100% while nobody had heard anything.
 */
export async function closeComplaint(complaintId: string, closureNote: string, outcomeForComplainant?: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!closureNote.trim()) {
    return { ok: false as const, error: "Written confirmation of the fix is required before closing." };
  }
  if (!(await hasPermission(session.tenant.id, "complaints.close"))) {
    return { ok: false as const, error: "You don't have permission to close complaints." };
  }

  const complaint = await getComplaint(complaintId);
  if (!complaint) return { ok: false as const, error: "That complaint could not be found." };

  const quality = await getQualityRecords(complaintId);
  if (!quality.capa || quality.capa.status !== "verified") {
    return { ok: false as const, error: "The CAPA must be recorded and verified before this case can close." };
  }

  const workflow = await getWorkflowVersion(complaint.workflow_version_id);
  const closedStage = workflow?.definition.stages.find((s) => s.key === "closed");
  if (!closedStage) return { ok: false as const, error: "This workflow has no closed stage configured." };

  // Where we can reach the complainant, we must — and we say so plainly
  // rather than closing quietly behind their back.
  const canReachComplainant = Boolean(complaint.reporter_email?.trim());
  if (canReachComplainant && !outcomeForComplainant?.trim()) {
    return {
      ok: false as const,
      error: "Write the message telling the complainant what was done — a case isn't closed until they've been informed.",
    };
  }

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.complaints)
    .update({
      current_stage_key: "closed",
      closed_at: now,
      // The moment the fix was confirmed, which is what the closed-loop clock
      // runs from — distinct from when the case was administratively closed.
      resolved_at: complaint.resolved_at ?? now,
      closure_note: closureNote.trim(),
    })
    .eq("id", complaintId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from(TABLES.complaintEvents).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaintId,
    actor_id: session.user.id,
    event_type: "complaint.closed",
    payload: { from: complaint.current_stage_key, note: closureNote.trim() },
  });

  let informed = false;
  if (canReachComplainant) {
    const result = await informComplainantOfClosure({
      tenantId: session.tenant.id,
      tenantName: session.tenant.name,
      complaintId,
      caseNumber: complaint.case_number,
      reporterName: complaint.reporter_name,
      reporterEmail: complaint.reporter_email,
      outcome: outcomeForComplainant!.trim(),
      actorId: session.user.id,
    }).catch(() => ({ sent: false as const }));
    informed = result.sent;
  }

  revalidatePath(`/complaints/${complaintId}`);
  // The case is closed either way — a bounced email must not leave a verified,
  // confirmed fix sitting open — but the caller is told, because "closed" and
  // "closed and they know" are different things.
  return { ok: true as const, complainantInformed: informed, couldReachComplainant: canReachComplainant };
}

/** Brief §6 "Customer communication" — acknowledgement, updates, final
 * response, with the channel it went out on. */
export async function logCommunication(complaintId: string, direction: "outbound" | "inbound", channel: string, message: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!message.trim()) return { ok: false as const, error: "Write what was said." };

  const complaint = await getComplaint(complaintId);
  if (!complaint) return { ok: false as const, error: "That complaint could not be found." };

  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.complaintCommunications).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaintId,
    actor_id: session.user.id,
    direction,
    channel,
    message: message.trim(),
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true as const };
}

/** Brief §6 "Compensation" — request a hamper/credit note; approval and
 * fulfilment happen in decideCompensation below, gated by a separate
 * permission (Finance's role, per the brief's §4 role table). */
export async function requestCompensation(complaintId: string, type: "hamper" | "credit_note" | "other", amountCents: number | null) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "complaints.compensation.request"))) {
    return { ok: false as const, error: "You don't have permission to request compensation." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.complaintCompensations).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaintId,
    type,
    amount_cents: amountCents,
    requested_by: session.user.id,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true as const };
}

export async function decideCompensation(compensationId: string, complaintId: string, status: "approved" | "declined" | "fulfilled") {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "complaints.compensation.approve"))) {
    return { ok: false as const, error: "You don't have permission to decide on compensation." };
  }

  const supabase = await createClient();
  const patch: Record<string, unknown> = { status, approved_by: session.user.id };
  if (status === "fulfilled") patch.fulfilled_at = new Date().toISOString();
  const { error } = await supabase.from(TABLES.complaintCompensations).update(patch).eq("id", compensationId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true as const };
}

/** Byte upload happens client-side straight to Supabase Storage (server
 * actions aren't the right shape for binary payloads); this just records
 * the resulting object as metadata once the upload succeeds. */
export async function recordAttachment(complaintId: string, fileName: string, storagePath: string, contentType: string | null) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };

  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.complaintAttachments).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaintId,
    uploaded_by: session.user.id,
    file_name: fileName,
    storage_path: storagePath,
    content_type: contentType,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true as const };
}

/** Batch-pattern check on demand (e.g. after product/batch fields are
 * filled in later than creation) — same thresholds as createComplaint's
 * own check, exposed here so the detail page can offer a "check now"
 * action without duplicating the escalation math. */
export async function checkBatchEscalation(complaintId: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return null;
  const complaint = await getComplaint(complaintId);
  if (!complaint?.sku || !complaint.batch_number) return null;
  const siblings = await getBatchSiblings(session.tenant.id, complaint.sku, complaint.batch_number, complaint.id);
  return { escalation: computeBatchEscalation(siblings, complaint.severity), siblings };
}
