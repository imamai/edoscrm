import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

/**
 * The workspace audit trail, for everything that is not case-scoped or that
 * needs a before/after pair.
 *
 * Case events (edoscrm_complaint_events) remain the readable story on a case.
 * This is the record an auditor is handed: who changed what, from what to
 * what, and why. The brief asks for "exportable audit records" and for
 * corrections to stay visible — both need the before/after that a case event
 * does not carry.
 */

export type AuditEntry = {
  id: string;
  tenant_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

/**
 * Write one audit entry. Deliberately not fire-and-forget: a silently dropped
 * audit write is worse than a visible failure, because it leaves a record that
 * looks complete and is not. Callers get the error and decide.
 */
export async function writeAudit(entry: {
  tenantId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.auditLogs).insert({
    tenant_id: entry.tenantId,
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Only the fields that actually changed, so an entry reads as a diff rather
 * than a copy of the whole row. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const [key, next] of Object.entries(after)) {
    const prev = before[key];
    if (prev === next) continue;
    // Treat null and "" as the same absence, so clearing an empty optional
    // field doesn't register as a change.
    if ((prev ?? "") === (next ?? "")) continue;
    b[key] = prev ?? null;
    a[key] = next ?? null;
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}

export type AuditFilters = { from?: string; to?: string; action?: string; entityType?: string; q?: string };

export async function getAuditLog(tenantId: string, filters: AuditFilters = {}, limit = 1000): Promise<AuditEntry[]> {
  const supabase = await createClient();
  let q = supabase.from(TABLES.auditLogs).select("*").eq("tenant_id", tenantId);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.entityType) q = q.eq("entity_type", filters.entityType);
  const term = (filters.q ?? "").trim();
  if (term) q = q.or(`action.ilike.%${term}%,entity_type.ilike.%${term}%,reason.ilike.%${term}%`);
  const { data } = await q.order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as AuditEntry[];
}

/** The distinct actions present, so the filter offers what actually exists
 * rather than a guessed list that drifts from reality. */
export async function getAuditActions(tenantId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from(TABLES.auditLogs).select("action").eq("tenant_id", tenantId).limit(5000);
  return Array.from(new Set((data ?? []).map((r) => r.action as string))).sort();
}
