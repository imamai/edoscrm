import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

export type Severity = "T1" | "T2" | "T3";

/**
 * Every way a complaint can reach this tenant, all converging on this one
 * table (ARCHITECTURE.md §7/§8). `web` is the one fully automated channel —
 * written only by the public /api/v1/intake endpoint. The rest are
 * staff-attested: an agent logging that a complaint came in by phone, email,
 * WhatsApp, social media, a Sales rep or in person, ahead of any of those
 * channels being automated individually (the ARCHITECTURE.md §7 "ceiling"
 * schema's dedicated edoscrm_complaint_channels/communications tables stay
 * deferred). `social` and `sales_rep` exist because the brief names both as
 * distinct inbound routes — without them, Digital/Marketing's whole intake and
 * the trade CFR route were invisible to "reporting by channel". `internal`
 * stays the catch-all for anything that reached staff another way.
 */
export type Channel = "internal" | "web" | "phone" | "email" | "whatsapp" | "walk_in" | "social" | "sales_rep";

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
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
  source: Channel;
  reporter_name: string | null;
  reporter_email: string | null;
  reporter_phone: string | null;
  // Product/batch fields (brief §6 "Required fields") — the data every
  // batch-grouping, escalation-pattern and "related complaints" feature
  // reads off. All nullable: not every complaint concerns a specific batch.
  category: string | null;
  product_name: string | null;
  sku: string | null;
  batch_number: string | null;
  production_date: string | null;
  expiry_date: string | null;
  purchase_details: string | null;
  pending_information: boolean;
  pending_information_reason: string | null;
  severity_override_reason: string | null;
  closure_note: string | null;
  /** The complainant as a record. Null for an anonymous report with neither
   * an email nor a phone number — a real case, but not a person we can file. */
  contact_id: string | null;
  // Stored moments, not derived state. Every time-based KPI reads these, which
  // is what lets a figure be reported for a past period instead of only for
  // right now.
  acknowledged_at: string | null;
  resolved_at: string | null;
  complainant_informed_at: string | null;
  satisfaction_rating: number | null;
  satisfaction_comment: string | null;
  satisfaction_at: string | null;
};

export type ComplaintFilters = {
  q?: string;
  status?: string;
  severity?: Severity;
  channel?: Channel;
  category?: string;
  /** Inclusive period on `created_at`, as ISO instants. */
  from?: string;
  to?: string;
};

export type ComplaintEvent = {
  id: string;
  complaint_id: string;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export async function getComplaints(tenantId: string, filters: ComplaintFilters = {}): Promise<Complaint[]> {
  const supabase = await createClient();
  let query = supabase.from(TABLES.complaints).select("*").eq("tenant_id", tenantId);

  if (filters.status) query = query.eq("current_stage_key", filters.status);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.channel) query = query.eq("source", filters.channel);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  if (filters.q) {
    const term = filters.q.trim();
    if (term) {
      // Every field the brief's §6 "Search and filtering" requirement names:
      // case number, complainant, product, SKU, batch — plus the title,
      // which is what people actually remember a case by.
      query = query.or(
        `case_number.ilike.%${term}%,title.ilike.%${term}%,reporter_name.ilike.%${term}%,product_name.ilike.%${term}%,sku.ilike.%${term}%,batch_number.ilike.%${term}%`,
      );
    }
  }

  const { data } = await query.order("created_at", { ascending: false });
  return data ?? [];
}

/** Other open complaints sharing the same SKU + batch — the brief's
 * "related product/batch complaints" visibility and pattern-escalation
 * rules both read off this one query. */
export async function getBatchSiblings(tenantId: string, sku: string, batchNumber: string, excludeId: string): Promise<Complaint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.complaints)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("sku", sku)
    .eq("batch_number", batchNumber)
    .neq("id", excludeId)
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
