import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

/**
 * Approved RCA/CAPA summaries, and a log of every time one is shared outside
 * the workspace.
 *
 * The brief permits sharing "approved RCA/CAPA summary … only on formal
 * request", with raw investigation notes staying internal. The restriction on
 * notes was already enforced by role; what was missing was the approved
 * summary itself — so the sharing happened by email attachment outside the
 * system, which defeats the restriction on the notes entirely.
 *
 * A summary is written by Quality, approved separately, and only then can it
 * be shared — three steps on purpose, because the point is that nothing leaves
 * the building unreviewed.
 */

export type RcaSummary = {
  id: string;
  tenant_id: string;
  complaint_id: string;
  summary: string;
  status: "draft" | "approved";
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

export type RcaShare = {
  id: string;
  summary_id: string;
  shared_with: string;
  note: string | null;
  shared_by: string | null;
  created_at: string;
};

export async function getRcaSummary(tenantId: string, complaintId: string): Promise<RcaSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.rcaSummaries)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("complaint_id", complaintId)
    .maybeSingle();
  return data as RcaSummary | null;
}

export async function getRcaSummaries(tenantId: string): Promise<(RcaSummary & { case_number: string; title: string })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.rcaSummaries)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as RcaSummary[];
  if (!rows.length) return [];

  const { data: complaints } = await supabase
    .from(TABLES.complaints)
    .select("id, case_number, title")
    .in("id", rows.map((r) => r.complaint_id));
  const byId = new Map((complaints ?? []).map((c) => [c.id as string, c]));

  return rows.map((r) => ({
    ...r,
    case_number: (byId.get(r.complaint_id)?.case_number as string) ?? "—",
    title: (byId.get(r.complaint_id)?.title as string) ?? "—",
  }));
}

export async function upsertRcaSummary(tenantId: string, complaintId: string, summary: string, createdBy: string) {
  const supabase = await createClient();
  const existing = await getRcaSummary(tenantId, complaintId);

  if (existing) {
    // Editing an approved summary sends it back to draft. An approval applies
    // to specific words, not to the record in general — otherwise the approval
    // step could be bypassed by approving something harmless and rewriting it.
    const { error } = await supabase
      .from(TABLES.rcaSummaries)
      .update({ summary, status: "draft", approved_by: null, approved_at: null })
      .eq("id", existing.id);
    return error ? { ok: false as const, error: error.message } : { ok: true as const, reset: existing.status === "approved" };
  }

  const { error } = await supabase
    .from(TABLES.rcaSummaries)
    .insert({ tenant_id: tenantId, complaint_id: complaintId, summary, created_by: createdBy });
  return error ? { ok: false as const, error: error.message } : { ok: true as const, reset: false };
}

export async function approveRcaSummary(tenantId: string, id: string, approvedBy: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.rcaSummaries)
    .update({ status: "approved", approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function recordShare(tenantId: string, summaryId: string, sharedWith: string, note: string, sharedBy: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.rcaSummaryShares)
    .insert({ tenant_id: tenantId, summary_id: summaryId, shared_with: sharedWith, note: note || null, shared_by: sharedBy });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

export async function getShares(tenantId: string, summaryId: string): Promise<RcaShare[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.rcaSummaryShares)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("summary_id", summaryId)
    .order("created_at", { ascending: false });
  return (data ?? []) as RcaShare[];
}
