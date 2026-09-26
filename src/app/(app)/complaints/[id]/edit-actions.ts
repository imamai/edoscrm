"use server";

import { revalidatePath } from "next/cache";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getComplaint } from "@/lib/data/complaints";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { writeAudit, diff } from "@/lib/data/audit";
import { findOrCreateContact } from "@/lib/data/contacts";

/**
 * Correct the facts on a complaint.
 *
 * There was no edit path at all: once logged, a batch number, expiry date or
 * product was permanent. Intake happens under pressure from a phone call and
 * batch numbers are exactly the field that gets mis-keyed — and a wrong batch
 * number silently breaks batch grouping and pattern escalation, so the case
 * never joins its siblings and the quality signal the whole system exists to
 * catch is lost invisibly.
 *
 * The brief forbids deleting a complaint and requires corrections to stay
 * visible in the audit trail. Both hold here: nothing is removed, and every
 * change is written as a before/after pair with the reason it was made.
 */

const EDITABLE = [
  "title",
  "description",
  "category",
  "product_name",
  "sku",
  "batch_number",
  "production_date",
  "expiry_date",
  "purchase_details",
  "reporter_name",
  "reporter_email",
  "reporter_phone",
] as const;

type Editable = (typeof EDITABLE)[number];

export async function updateComplaintDetails(complaintId: string, formData: FormData, reason: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "complaints.manage"))) {
    return { ok: false as const, error: "You don't have permission to edit complaints." };
  }
  if (!reason.trim()) {
    return { ok: false as const, error: "Say why this is being corrected — the reason is part of the audit trail." };
  }

  const complaint = await getComplaint(complaintId);
  if (!complaint || complaint.tenant_id !== session.tenant.id) {
    return { ok: false as const, error: "That complaint could not be found." };
  }
  if (complaint.current_stage_key === "closed") {
    return { ok: false as const, error: "A closed case can't be edited. Reopen it first if something needs correcting." };
  }

  const next: Partial<Record<Editable, string | null>> = {};
  for (const field of EDITABLE) {
    const raw = formData.get(field);
    if (raw === null) continue;
    const value = String(raw).trim();
    next[field] = value === "" ? null : value;
  }

  const changes = diff(complaint as unknown as Record<string, unknown>, next);
  if (!changes.changed) return { ok: true as const, changed: false };

  // A corrected email or phone number may mean a different person, or the same
  // person we previously failed to match. Re-resolving keeps the contact
  // record honest instead of leaving the case attached to whoever it first hit.
  const contactTouched = "reporter_email" in next || "reporter_phone" in next || "reporter_name" in next;
  const contactId = contactTouched
    ? await findOrCreateContact(session.tenant.id, {
        name: next.reporter_name ?? complaint.reporter_name,
        email: next.reporter_email ?? complaint.reporter_email,
        phone: next.reporter_phone ?? complaint.reporter_phone,
      })
    : complaint.contact_id;

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.complaints)
    .update({ ...next, contact_id: contactId })
    .eq("id", complaintId);
  if (error) return { ok: false as const, error: error.message };

  // Two records, deliberately. The case event is the readable story on the
  // case; the audit entry carries the before/after an auditor needs.
  await supabase.from(TABLES.complaintEvents).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaintId,
    actor_id: session.user.id,
    event_type: "complaint.corrected",
    payload: { fields: Object.keys(changes.after), reason: reason.trim() },
  });

  const audit = await writeAudit({
    tenantId: session.tenant.id,
    actorId: session.user.id,
    action: "complaint.corrected",
    entityType: "complaint",
    entityId: complaintId,
    before: changes.before,
    after: changes.after,
    reason: reason.trim(),
  });
  if (!audit.ok) {
    // The correction stands, but an unrecorded correction breaks the rule the
    // brief actually cares about, so say so rather than reporting clean success.
    return { ok: true as const, changed: true, auditWarning: audit.error };
  }

  revalidatePath(`/complaints/${complaintId}`);
  return { ok: true as const, changed: true };
}
