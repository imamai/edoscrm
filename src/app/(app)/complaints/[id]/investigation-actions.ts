"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { getComplaint } from "@/lib/data/complaints";
import { TABLES } from "@/lib/data/tables";

async function logEvent(complaintId: string, tenantId: string, actorId: string, eventType: string, payload: object) {
  const supabase = await createClient();
  await supabase.from(TABLES.complaintEvents).insert({
    tenant_id: tenantId,
    complaint_id: complaintId,
    actor_id: actorId,
    event_type: eventType,
    payload,
  });
}

export async function upsertInvestigation(complaintId: string, formData: FormData) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };

  const findings = String(formData.get("findings") ?? "").trim();
  if (!findings) return { ok: false as const, error: "Describe what the investigation found." };

  const complaint = await getComplaint(complaintId);
  if (!complaint) return { ok: false as const, error: "That complaint could not be found." };

  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.investigations).upsert(
    {
      tenant_id: session.tenant.id,
      complaint_id: complaintId,
      findings,
      investigator_id: session.user.id,
      created_by: session.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "complaint_id" },
  );

  if (error) return { ok: false as const, error: "You don't have permission to record an investigation." };
  await logEvent(complaintId, session.tenant.id, session.user.id, "investigation.recorded", {});
  return { ok: true as const };
}

export async function upsertRootCause(complaintId: string, formData: FormData) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };

  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { ok: false as const, error: "Describe the root cause." };

  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.rootCauses).upsert(
    {
      tenant_id: session.tenant.id,
      complaint_id: complaintId,
      category,
      description,
      created_by: session.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "complaint_id" },
  );

  if (error) return { ok: false as const, error: "You don't have permission to record a root cause." };
  await logEvent(complaintId, session.tenant.id, session.user.id, "root_cause.recorded", { category });
  return { ok: true as const };
}

export async function upsertCapa(complaintId: string, formData: FormData) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };

  const correctiveAction = String(formData.get("corrective_action") ?? "").trim();
  const preventiveAction = String(formData.get("preventive_action") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const status = String(formData.get("status") ?? "open");
  if (!correctiveAction) return { ok: false as const, error: "Describe the corrective action." };

  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.capas).upsert(
    {
      tenant_id: session.tenant.id,
      complaint_id: complaintId,
      corrective_action: correctiveAction,
      preventive_action: preventiveAction || null,
      due_date: dueDate || null,
      status,
      verified_at: status === "verified" || status === "closed" ? new Date().toISOString() : null,
      created_by: session.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "complaint_id" },
  );

  if (error) return { ok: false as const, error: "You don't have permission to record a CAPA." };
  await logEvent(complaintId, session.tenant.id, session.user.id, "capa.recorded", { status });
  return { ok: true as const };
}
