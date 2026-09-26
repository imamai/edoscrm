import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

export type WorkflowStageDef = { key: string; label: string };
export type WorkflowDefinition = { stages: WorkflowStageDef[] };

export type WorkflowVersion = {
  id: string;
  definition: WorkflowDefinition;
};

/** The workflow a new complaint gets pinned to. One default per tenant for
 * now (ARCHITECTURE.md §13 defers the workflow builder — every tenant runs
 * the one workflow seeded at provisioning until there's a real second
 * workflow to design multi-workflow selection against). */
export async function getDefaultWorkflowVersion(tenantId: string): Promise<WorkflowVersion | null> {
  const supabase = await createClient();
  const { data: workflow } = await supabase
    .from(TABLES.workflows)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .maybeSingle();
  if (!workflow) return null;

  const { data: version } = await supabase
    .from(TABLES.workflowVersions)
    .select("id, definition")
    .eq("workflow_id", workflow.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) return null;

  return { id: version.id, definition: version.definition as WorkflowDefinition };
}

export async function getWorkflowVersion(id: string): Promise<WorkflowVersion | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.workflowVersions)
    .select("id, definition")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, definition: data.definition as WorkflowDefinition };
}
