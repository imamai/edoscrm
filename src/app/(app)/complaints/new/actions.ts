"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { TABLES } from "@/lib/data/tables";

export async function createComplaint(formData: FormData) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const severity = String(formData.get("severity") ?? "T3");

  if (!title) return { ok: false as const, error: "Give the complaint a title." };

  const workflow = await getDefaultWorkflowVersion(session.tenant.id);
  if (!workflow) return { ok: false as const, error: "This workspace has no workflow set up yet." };

  const firstStage = workflow.definition.stages[0]?.key;
  if (!firstStage) return { ok: false as const, error: "This workspace's workflow has no stages." };

  const supabase = await createClient();

  const { data: caseNumber, error: numberError } = await supabase.rpc("edoscrm_next_case_number", {
    p_tenant_id: session.tenant.id,
  });
  if (numberError) return { ok: false as const, error: numberError.message };

  const { data: complaint, error: insertError } = await supabase
    .from(TABLES.complaints)
    .insert({
      tenant_id: session.tenant.id,
      case_number: caseNumber,
      title,
      description: description || null,
      severity,
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

  return { ok: true as const, id: complaint.id as string };
}
