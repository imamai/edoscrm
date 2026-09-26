import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

export type Severity = "T1" | "T2" | "T3";

export type Complaint = {
  id: string;
  tenant_id: string;
  case_number: string;
  title: string;
  description: string | null;
  severity: Severity;
  workflow_version_id: string;
  current_stage_key: string;
  assignee_id: string | null;
  department_id: string | null;
  created_by: string;
  created_at: string;
  closed_at: string | null;
};

export type ComplaintEvent = {
  id: string;
  complaint_id: string;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export async function getComplaints(tenantId: string): Promise<Complaint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.complaints)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getComplaint(id: string): Promise<Complaint | null> {
  const supabase = await createClient();
  const { data } = await supabase.from(TABLES.complaints).select("*").eq("id", id).maybeSingle();
  return data;
}

export async function getComplaintEvents(complaintId: string): Promise<ComplaintEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.complaintEvents)
    .select("*")
    .eq("complaint_id", complaintId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/** stage_key -> ISO timestamp of the event that first moved the case into
 * it, for the stepper's "reached {date}" caption (ARCHITECTURE.md's own
 * WorkflowStepper prop contract, ported as-is). */
export function stageDatesFromEvents(events: ComplaintEvent[]): Record<string, string> {
  const dates: Record<string, string> = {};
  for (const event of events) {
    if (event.event_type === "complaint.created") {
      const to = event.payload.stage as string | undefined;
      if (to && !dates[to]) dates[to] = event.created_at;
    }
    if (event.event_type === "stage.changed") {
      const to = event.payload.to as string | undefined;
      if (to && !dates[to]) dates[to] = event.created_at;
    }
  }
  return dates;
}
