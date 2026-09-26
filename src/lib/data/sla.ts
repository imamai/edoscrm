import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import type { Severity } from "@/lib/data/complaints";

export type SlaRule = {
  acknowledgement_minutes: number;
  rca_minutes: number | null;
  /** The brief's separate "issue resolution plan" deadline. Only T2 has one. */
  resolution_plan_minutes: number | null;
};

export async function getSlaRules(tenantId: string): Promise<Record<Severity, SlaRule>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.slaRules)
    .select("severity, acknowledgement_minutes, rca_minutes, resolution_plan_minutes")
    .eq("tenant_id", tenantId);

  return Object.fromEntries((data ?? []).map((r) => [r.severity, r])) as Record<Severity, SlaRule>;
}

/** Edit a severity's deadlines. A null RCA or resolution-plan deadline is
 * meaningful, not missing: T3 deliberately has no RCA deadline, because the
 * brief asks only that a minor complaint be logged, acknowledged and reviewed
 * weekly. */
export async function updateSlaRule(
  tenantId: string,
  severity: Severity,
  values: { acknowledgement_minutes: number; rca_minutes: number | null; resolution_plan_minutes: number | null },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.slaRules)
    .update(values)
    .eq("tenant_id", tenantId)
    .eq("severity", severity);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
