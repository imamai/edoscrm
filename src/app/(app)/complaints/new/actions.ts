"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { getBatchSiblings, type Severity } from "@/lib/data/complaints";
import { computeBatchEscalation } from "@/lib/domain/escalation";
import { notifyUsers, usersWithPermission } from "@/lib/data/notifications";
import { findOrCreateContact } from "@/lib/data/contacts";
import { getTenantSettings } from "@/lib/data/settings";
import { acknowledgeComplainant } from "@/lib/notify/complainant";
import { suggestComplaintDetails, type ComplaintSuggestion } from "@/lib/ai/suggest";
import { TABLES } from "@/lib/data/tables";

export interface SuggestState {
  error: string | null;
  suggestion: ComplaintSuggestion | null;
}

export async function suggestComplaintFromText(_prev: SuggestState, form: FormData): Promise<SuggestState> {
  const session = await resolveSession();
  if (session.kind !== "ok") return { error: "Your session has expired.", suggestion: null };

  const text = String(form.get("free_text") ?? "").trim();
  if (!text) return { error: "Describe what happened first.", suggestion: null };

  try {
    const suggestion = await suggestComplaintDetails(text, [
      "Product quality", "Foreign object", "Packaging", "Labelling", "Delivery / logistics", "Customer service", "Pricing / billing", "Other",
    ]);
    return { error: null, suggestion };
  } catch {
    return { error: "Couldn't get a suggestion right now — fill it in yourself.", suggestion: null };
  }
}

function orNull(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createComplaint(formData: FormData) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };

  const title = String(formData.get("title") ?? "").trim();
  const description = orNull(formData, "description");
  const severity = String(formData.get("severity") ?? "T3") as Severity;
  const channel = String(formData.get("channel") ?? "internal");
  const category = orNull(formData, "category");
  const reporterName = orNull(formData, "reporter_name");
  const reporterEmail = orNull(formData, "reporter_email");
  const reporterPhone = orNull(formData, "reporter_phone");
  const productName = orNull(formData, "product_name");
  const sku = orNull(formData, "sku");
  const batchNumber = orNull(formData, "batch_number");
  const productionDate = orNull(formData, "production_date");
  const expiryDate = orNull(formData, "expiry_date");
  const purchaseDetails = orNull(formData, "purchase_details");

  if (!title) return { ok: false as const, error: "Give the complaint a title." };

  const workflow = await getDefaultWorkflowVersion(session.tenant.id);
  if (!workflow) return { ok: false as const, error: "This workspace has no workflow set up yet." };

  const firstStage = workflow.definition.stages[0]?.key;
  if (!firstStage) return { ok: false as const, error: "This workspace's workflow has no stages." };

  const supabase = await createClient();
  const settings = await getTenantSettings(session.tenant.id);

  const { data: caseNumber, error: numberError } = await supabase.rpc("edoscrm_next_case_number", {
    p_tenant_id: session.tenant.id,
  });
  if (numberError) return { ok: false as const, error: numberError.message };

  // The complainant becomes a record, so a second complaint from the same
  // person joins the first instead of starting again from nothing. Returns
  // null for an anonymous report with neither an email nor a phone number —
  // a real complaint, but not a person we can file.
  const contactId = await findOrCreateContact(session.tenant.id, {
    name: reporterName,
    email: reporterEmail,
    phone: reporterPhone,
    type: channel === "sales_rep" ? "trade" : "consumer",
  });

  const { data: complaint, error: insertError } = await supabase
    .from(TABLES.complaints)
    .insert({
      tenant_id: session.tenant.id,
      case_number: caseNumber,
      contact_id: contactId,
      title,
      description,
      severity,
      source: channel,
      category,
      reporter_name: reporterName,
      reporter_email: reporterEmail,
      reporter_phone: reporterPhone,
      product_name: productName,
      sku,
      batch_number: batchNumber,
      production_date: productionDate,
      expiry_date: expiryDate,
      purchase_details: purchaseDetails,
      workflow_version_id: workflow.id,
      current_stage_key: firstStage,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (insertError) return { ok: false as const, error: insertError.message };

  await supabase.from(TABLES.complaintEvents).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaint.id,
    actor_id: session.user.id,
    event_type: "complaint.created",
    payload: { stage: firstStage, severity },
  });

  // Brief §"Required notifications": T1 needs Head of Marketing + Quality
  // notified within 1 hour — fired immediately, since nothing here is
  // scheduled. Batch pattern check runs whenever both SKU and batch are
  // known, matching the brief's escalation-procedure thresholds.
  const notifyTargets = new Set<string>();
  if (severity === "T1") {
    const [marketingOps, quality] = await Promise.all([
      usersWithPermission(session.tenant.id, "complaints.manage"),
      usersWithPermission(session.tenant.id, "investigations.manage"),
    ]);
    for (const id of [...marketingOps, ...quality]) notifyTargets.add(id);
  }
  if (notifyTargets.size > 0) {
    await notifyUsers(session.tenant.id, [...notifyTargets], `T1 complaint ${caseNumber}: ${title}`, complaint.id);
  }

  if (sku && batchNumber) {
    const siblings = await getBatchSiblings(session.tenant.id, sku, batchNumber, complaint.id);
    const escalation = computeBatchEscalation(siblings, severity, settings);
    if (escalation.level !== "none") {
      const escalationTargets = await usersWithPermission(session.tenant.id, "complaints.manage");
      await notifyUsers(session.tenant.id, escalationTargets, `${caseNumber} (${sku}/${batchNumber}): ${escalation.message}`, complaint.id);
    }
  }

  // The closing half of the loop the brief asks for: "immediate case-reference
  // acknowledgement to the logger and, where contact details exist, the
  // complainant". Best-effort — a complaint that is logged but cannot be
  // acknowledged is still logged, and failing the whole submission because an
  // email bounced would lose the record the system exists to keep.
  if (settings.auto_acknowledge) {
    await acknowledgeComplainant({
      tenantId: session.tenant.id,
      tenantName: session.tenant.name,
      complaintId: complaint.id as string,
      caseNumber: caseNumber as string,
      title,
      reporterName,
      reporterEmail,
    }).catch(() => undefined);
  }

  return { ok: true as const, id: complaint.id as string };
}
