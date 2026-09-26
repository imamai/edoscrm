"use server";

import { revalidatePath } from "next/cache";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { findOrCreateContact } from "@/lib/data/contacts";
import { getTenantSettings } from "@/lib/data/settings";
import { acknowledgeComplainant } from "@/lib/notify/complainant";
import type { Severity } from "@/lib/data/complaints";

/**
 * Turning an inbound email into a complaint.
 *
 * Deliberately a human step — the brief asks for a *controlled* email-to-case
 * process. Auto-creating a case from every message would fill the register
 * with auto-replies and newsletters, each with a case number and an
 * acknowledgement, and batch patterns are counted off these records.
 */
export async function convertInboundEmail(
  id: string,
  values: { title: string; severity: Severity; category: string | null },
) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "complaints.create"))) {
    return { ok: false as const, error: "You don't have permission to log complaints." };
  }
  if (!values.title.trim()) return { ok: false as const, error: "Give the complaint a title." };

  const supabase = await createClient();
  const { data: email } = await supabase
    .from(TABLES.inboundEmails)
    .select("*")
    .eq("tenant_id", session.tenant.id)
    .eq("id", id)
    .maybeSingle();

  if (!email) return { ok: false as const, error: "That message could not be found." };
  if (email.status !== "received") return { ok: false as const, error: "That message has already been handled." };

  const workflow = await getDefaultWorkflowVersion(session.tenant.id);
  const firstStage = workflow?.definition.stages[0]?.key;
  if (!workflow || !firstStage) return { ok: false as const, error: "This workspace has no workflow set up yet." };

  const { data: caseNumber, error: numberError } = await supabase.rpc("edoscrm_next_case_number", {
    p_tenant_id: session.tenant.id,
  });
  if (numberError) return { ok: false as const, error: numberError.message };

  const contactId = await findOrCreateContact(session.tenant.id, {
    name: email.from_name as string | null,
    email: email.from_email as string,
  });

  const { data: complaint, error: insertError } = await supabase
    .from(TABLES.complaints)
    .insert({
      tenant_id: session.tenant.id,
      case_number: caseNumber,
      contact_id: contactId,
      title: values.title.trim(),
      description: email.body as string | null,
      severity: values.severity,
      source: "email",
      category: values.category,
      reporter_name: email.from_name as string | null,
      reporter_email: email.from_email as string,
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
    payload: { stage: firstStage, severity: values.severity, from: "inbound_email" },
  });

  // The original message is kept as the first communication on the case, so
  // the trail starts with what the complainant actually wrote rather than with
  // somebody's summary of it.
  await supabase.from(TABLES.complaintCommunications).insert({
    tenant_id: session.tenant.id,
    complaint_id: complaint.id,
    actor_id: session.user.id,
    direction: "inbound",
    channel: "email",
    message: `${email.subject as string}\n\n${(email.body as string) ?? ""}`.slice(0, 10000),
  });

  await supabase
    .from(TABLES.inboundEmails)
    .update({ status: "converted", complaint_id: complaint.id, handled_by: session.user.id, handled_at: new Date().toISOString() })
    .eq("id", id);

  const settings = await getTenantSettings(session.tenant.id);
  if (settings.auto_acknowledge) {
    await acknowledgeComplainant({
      tenantId: session.tenant.id,
      tenantName: session.tenant.name,
      complaintId: complaint.id as string,
      caseNumber: caseNumber as string,
      title: values.title.trim(),
      reporterName: email.from_name as string | null,
      reporterEmail: email.from_email as string,
    }).catch(() => undefined);
  }

  revalidatePath("/inbox");
  return { ok: true as const, complaintId: complaint.id as string, caseNumber: caseNumber as string };
}

/** Not every message is a complaint. Dismissed messages are kept, not deleted,
 * so "why was this never actioned" has an answer. */
export async function dismissInboundEmail(id: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "complaints.create"))) {
    return { ok: false as const, error: "You don't have permission to handle the inbox." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.inboundEmails)
    .update({ status: "rejected", handled_by: session.user.id, handled_at: new Date().toISOString() })
    .eq("tenant_id", session.tenant.id)
    .eq("id", id)
    .eq("status", "received");

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/inbox");
  return { ok: true as const };
}
