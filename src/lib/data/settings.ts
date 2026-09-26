import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

/**
 * Everything a workspace can configure for itself: escalation thresholds,
 * retention, report cadence, complaint categories and KPI targets.
 *
 * These used to be constants in the codebase. Thresholds tuned for one product
 * category are wrong for another, and in a multi-tenant product a compiled-in
 * threshold means every tenant shares one company's risk appetite — which the
 * brief anticipates by asking for "configurable" pattern rules.
 */

export type TenantSettings = {
  tenant_id: string;
  warn_count: number;
  warn_hours: number;
  escalate_count: number;
  escalate_hours: number;
  mandatory_rca_count: number;
  mandatory_rca_hours: number;
  withdrawal_count: number;
  withdrawal_hours: number;
  t3_escalate_count: number;
  t3_escalate_days: number;
  retention_days: number | null;
  weekly_report_enabled: boolean;
  monthly_report_enabled: boolean;
  auto_acknowledge: boolean;
};

/** The brief's own numbers, used when a workspace has no row yet. */
export const DEFAULT_SETTINGS: Omit<TenantSettings, "tenant_id"> = {
  warn_count: 2,
  warn_hours: 48,
  escalate_count: 3,
  escalate_hours: 48,
  mandatory_rca_count: 5,
  mandatory_rca_hours: 72,
  withdrawal_count: 10,
  withdrawal_hours: 72,
  t3_escalate_count: 3,
  t3_escalate_days: 7,
  retention_days: null,
  weekly_report_enabled: true,
  monthly_report_enabled: true,
  auto_acknowledge: true,
};

export async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from(TABLES.tenantSettings).select("*").eq("tenant_id", tenantId).maybeSingle();
  return (data as TenantSettings | null) ?? { tenant_id: tenantId, ...DEFAULT_SETTINGS };
}

export async function updateTenantSettings(tenantId: string, values: Partial<Omit<TenantSettings, "tenant_id">>) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.tenantSettings)
    .upsert({ tenant_id: tenantId, ...values, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/* ----------------------------- categories ----------------------------- */

export type Category = { id: string; name: string; sort_order: number; is_active: boolean };

export async function getCategories(tenantId: string, includeInactive = false): Promise<Category[]> {
  const supabase = await createClient();
  let q = supabase.from(TABLES.categories).select("id, name, sort_order, is_active").eq("tenant_id", tenantId);
  if (!includeInactive) q = q.eq("is_active", true);
  const { data } = await q.order("sort_order").order("name");
  return (data ?? []) as Category[];
}

export async function addCategory(tenantId: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.categories).insert({ tenant_id: tenantId, name: name.trim() });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/** Categories are retired rather than deleted: complaints already filed under
 * one keep their label, and the history stays readable. */
export async function setCategoryActive(tenantId: string, id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.categories).update({ is_active: isActive }).eq("tenant_id", tenantId).eq("id", id);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/* ----------------------------- KPI targets ---------------------------- */

export type KpiTarget = { key: string; target_pct: number | null; direction: "gte" | "lte" | "down" };

export async function getKpiTargets(tenantId: string): Promise<Record<string, KpiTarget>> {
  const supabase = await createClient();
  const { data } = await supabase.from(TABLES.kpiTargets).select("key, target_pct, direction").eq("tenant_id", tenantId);
  return Object.fromEntries((data ?? []).map((r) => [r.key as string, r as KpiTarget]));
}

export async function updateKpiTarget(tenantId: string, key: string, targetPct: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.kpiTargets)
    .upsert({ tenant_id: tenantId, key, target_pct: targetPct }, { onConflict: "tenant_id,key" });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
