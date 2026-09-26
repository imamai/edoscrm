import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { sendEmail } from "@/lib/notify/email";

/**
 * The messages that go to the person who complained, rather than to staff.
 *
 * The brief asks for an immediate case-reference acknowledgement to the
 * complainant, and forbids resolving a case until they have been informed.
 * Both were previously manual: the address was captured and never used, so the
 * closed loop had no automated closing side and the closed-loop KPI measured
 * internal paperwork rather than accountability to anyone.
 *
 * Every send is recorded as a communication on the case and stamps the
 * matching timestamp, so the log reflects what actually happened rather than
 * what someone remembered to type in afterwards.
 */

const WRAP = (tenantName: string, body: string) => `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#12141c;max-width:560px">
    ${body}
    <p style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e5ec;font-size:13px;color:#6b7080">
      ${escapeHtml(tenantName)}
    </p>
  </div>`;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Outcome = { sent: boolean; reason?: string };

/**
 * Acknowledge a complaint to the person who raised it.
 *
 * Returns rather than throws when there is no address: an anonymous walk-in
 * complaint is perfectly valid and must not fail to be logged because nobody
 * can be emailed about it.
 */
export async function acknowledgeComplainant(params: {
  tenantId: string;
  tenantName: string;
  complaintId: string;
  caseNumber: string;
  title: string;
  reporterName: string | null;
  reporterEmail: string | null;
}): Promise<Outcome> {
  if (!params.reporterEmail?.trim()) return { sent: false, reason: "no email on file" };

  const greeting = params.reporterName ? `Hello ${escapeHtml(params.reporterName)},` : "Hello,";
  const body = `
    <p>${greeting}</p>
    <p>Thank you for letting us know about this. We have logged your complaint and it is being looked into.</p>
    <p><strong>Your reference is ${escapeHtml(params.caseNumber)}.</strong> Please quote it if you contact us again about this.</p>
    <p style="color:#6b7080">What you told us: ${escapeHtml(params.title)}</p>
    <p>We will come back to you with an update. If anything changes in the meantime, or you have more information such as a batch number or a photograph, reply to this message and it will reach the team handling it.</p>`;

  const message = `Acknowledgement sent for ${params.caseNumber}.`;
  const result = await sendEmail({
    to: params.reporterEmail.trim(),
    subject: `${params.tenantName}: we have received your complaint (${params.caseNumber})`,
    html: WRAP(params.tenantName, body),
  }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "send failed" }));

  const ok = (result as { ok?: boolean })?.ok !== false;
  if (!ok) return { sent: false, reason: "delivery failed" };

  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase.from(TABLES.complaintCommunications).insert({
    tenant_id: params.tenantId,
    complaint_id: params.complaintId,
    actor_id: null, // the system sent this, not a person
    direction: "outbound",
    channel: "email",
    message: `${message} ${params.reporterEmail.trim()}`,
  });
  await supabase.from(TABLES.complaints).update({ acknowledged_at: now }).eq("id", params.complaintId);

  return { sent: true };
}

/**
 * Tell the complainant the case is resolved, and what was done about it.
 *
 * The outcome text is written by a person — this deliberately does not
 * generate the substance, because what to tell a complainant about a product
 * defect is a human decision with commercial and legal weight.
 */
export async function informComplainantOfClosure(params: {
  tenantId: string;
  tenantName: string;
  complaintId: string;
  caseNumber: string;
  reporterName: string | null;
  reporterEmail: string | null;
  outcome: string;
  actorId: string | null;
}): Promise<Outcome> {
  if (!params.reporterEmail?.trim()) return { sent: false, reason: "no email on file" };

  const greeting = params.reporterName ? `Hello ${escapeHtml(params.reporterName)},` : "Hello,";
  const body = `
    <p>${greeting}</p>
    <p>We have finished looking into your complaint, reference <strong>${escapeHtml(params.caseNumber)}</strong>.</p>
    <p>${escapeHtml(params.outcome).replace(/\n/g, "<br>")}</p>
    <p>Thank you for taking the time to tell us. If you do not feel this resolves the matter, reply to this message and we will reopen it.</p>`;

  const result = await sendEmail({
    to: params.reporterEmail.trim(),
    subject: `${params.tenantName}: your complaint ${params.caseNumber} — outcome`,
    html: WRAP(params.tenantName, body),
  }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "send failed" }));

  const ok = (result as { ok?: boolean })?.ok !== false;
  if (!ok) return { sent: false, reason: "delivery failed" };

  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase.from(TABLES.complaintCommunications).insert({
    tenant_id: params.tenantId,
    complaint_id: params.complaintId,
    actor_id: params.actorId,
    direction: "outbound",
    channel: "email",
    message: `Closing message sent to ${params.reporterEmail.trim()}: ${params.outcome}`,
  });
  await supabase.from(TABLES.complaints).update({ complainant_informed_at: now }).eq("id", params.complaintId);

  return { sent: true };
}

/** A progress update mid-case — the brief's "updates" between acknowledgement
 * and outcome. Recorded, but does not stamp a lifecycle timestamp, because an
 * update is not acknowledgement and not closure. */
export async function updateComplainant(params: {
  tenantId: string;
  tenantName: string;
  complaintId: string;
  caseNumber: string;
  reporterName: string | null;
  reporterEmail: string | null;
  update: string;
  actorId: string | null;
}): Promise<Outcome> {
  if (!params.reporterEmail?.trim()) return { sent: false, reason: "no email on file" };

  const greeting = params.reporterName ? `Hello ${escapeHtml(params.reporterName)},` : "Hello,";
  const body = `
    <p>${greeting}</p>
    <p>An update on your complaint, reference <strong>${escapeHtml(params.caseNumber)}</strong>:</p>
    <p>${escapeHtml(params.update).replace(/\n/g, "<br>")}</p>`;

  const result = await sendEmail({
    to: params.reporterEmail.trim(),
    subject: `${params.tenantName}: update on your complaint (${params.caseNumber})`,
    html: WRAP(params.tenantName, body),
  }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "send failed" }));

  if ((result as { ok?: boolean })?.ok === false) return { sent: false, reason: "delivery failed" };

  const supabase = await createClient();
  await supabase.from(TABLES.complaintCommunications).insert({
    tenant_id: params.tenantId,
    complaint_id: params.complaintId,
    actor_id: params.actorId,
    direction: "outbound",
    channel: "email",
    message: `Update sent to ${params.reporterEmail.trim()}: ${params.update}`,
  });
  return { sent: true };
}
