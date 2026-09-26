import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import type { Severity } from "@/lib/data/complaints";

export type SlaRule = { acknowledgement_minutes: number; rca_minutes: number | null };

export async function getSlaRules(tenantId: string): Promise<Record<Severity, SlaRule>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.slaRules)
    .select("severity, acknowledgement_minutes, rca_minutes")
    .eq("tenant_id", tenantId);

  const rules = Object.fromEntries((data ?? []).map((r) => [r.severity, r])) as Record<Severity, SlaRule>;
  return rules;
}
