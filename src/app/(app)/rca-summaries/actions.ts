"use server";

import { revalidatePath } from "next/cache";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { upsertRcaSummary, approveRcaSummary, recordShare } from "@/lib/data/rca-summaries";
import { sendEmail } from "@/lib/notify/email";
import { writeAudit } from "@/lib/data/audit";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

export async function saveSummaryAction(complaintId: string, summary: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "investigations.manage"))) {
    return { ok: false as const, error: "You don't have permission to write RCA summaries." };
  }
  if (!summary.trim()) return { ok: false as const, error: "Write the summary before saving it." };

  const result = await upsertRcaSummary(session.tenant.id, complaintId, summary.trim(), session.user.id);
  if (!result.ok) return result;

  await writeAudit({
    tenantId: session.tenant.id,
    actorId: session.user.id,
    action: "rca_summary.saved",
    entityType: "rca_summary",
    entityId: complaintId,
  });

  revalidatePath("/rca-summaries");
  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true as const, reset: result.reset };
}

export async function approveSummaryAction(id: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "rca.summary.approve"))) {
    return { ok: false as const, error: "You don't have permission to approve summaries for sharing." };
  }

  const result = await approveRcaSummary(session.tenant.id, id, session.user.id);
  if (!result.ok) return result;

  await writeAudit({
    tenantId: session.tenant.id,
    actorId: session.user.id,
    action: "rca_summary.approved",
    entityType: "rca_summary",
    entityId: id,
  });

  revalidatePath("/rca-summaries");
  return { ok: true as const };
}

/**
 * Send an approved summary outside the workspace.
 *
 * Re-reads the record rather than trusting what the page passed in, because
 * "only approved summaries may be shared" is the rule, and a stale page that
 * still thinks a summary is approved must not be able to send it.
 */
export async function shareSummaryAction(id: string, recipient: string, note: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "rca.summary.share"))) {
    return { ok: false as const, error: "You don't have permission to share summaries." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim())) {
    return { ok: false as const, error: "Enter a valid email address to send it to." };
  }

  const supabase = await createClient();
  const { data: summary } = await supabase
    .from(TABLES.rcaSummaries)
    .select("id, summary, status, complaint_id")
    .eq("tenant_id", session.tenant.id)
    .eq("id", id)
    .maybeSingle();

  if (!summary) return { ok: false as const, error: "That summary could not be found." };
  if (summary.status !== "approved") {
    return { ok: false as const, error: "Only an approved summary can be shared. Have it approved first." };
  }

  const { data: complaint } = await supabase
    .from(TABLES.complaints)
    .select("case_number")
    .eq("id", summary.complaint_id as string)
    .maybeSingle();

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sent = await sendEmail({
    to: recipient.trim(),
    subject: `${session.tenant.name}: investigation summary — ${complaint?.case_number ?? "complaint"}`,
    html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;max-width:560px;color:#12141c">
             <p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7080;font-weight:700;margin:0">
               Approved investigation summary
             </p>
             <h1 style="font-size:18px;color:#1d3557;margin:4px 0 12px">${esc(complaint?.case_number ?? "")}</h1>
             ${note.trim() ? `<p>${esc(note.trim())}</p>` : ""}
             <div style="border-left:3px solid #1d3557;padding-left:14px;margin:14px 0">
               ${esc(summary.summary as string).replace(/\n/g, "<br>")}
             </div>
             <p style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e5ec;font-size:12px;color:#6b7080">
               ${esc(session.tenant.name)}. This is an approved summary; the underlying investigation notes are internal.
             </p>
           </div>`,
  }).catch(() => ({ ok: false as const, error: "send failed" }));

  if (!sent.ok) return { ok: false as const, error: "That summary could not be emailed. Check the address and try again." };

  await recordShare(session.tenant.id, id, recipient.trim(), note.trim(), session.user.id);
  await writeAudit({
    tenantId: session.tenant.id,
    actorId: session.user.id,
    action: "rca_summary.shared",
    entityType: "rca_summary",
    entityId: id,
    after: { shared_with: recipient.trim() },
    reason: note.trim() || null,
  });

  revalidatePath("/rca-summaries");
  return { ok: true as const };
}
