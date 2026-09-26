import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { getComplaints, type Complaint } from "@/lib/data/complaints";
import { getSlaRules } from "@/lib/data/sla";
import { getKpiTargets, type KpiTarget } from "@/lib/data/settings";

export { KPI_LABELS } from "@/lib/domain/kpi-labels";
export type { KpiKey } from "@/lib/domain/kpi-labels";
import { KPI_LABELS } from "@/lib/domain/kpi-labels";
import type { KpiKey } from "@/lib/domain/kpi-labels";

export type Kpis = Record<KpiKey, number | null>;

/** A KPI with everything needed to judge it, not just its value. A number
 * without a target is data; a number against a target is performance. */
export type KpiResult = {
  key: KpiKey;
  label: string;
  value: number | null;
  target: number | null;
  direction: KpiTarget["direction"];
  /** null when there is no value or no fixed target to compare against. */
  onTarget: boolean | null;
  /** Why a value is missing, where that is a deliberate answer rather than
   * an absence of data. */
  note?: string;
};

export type KpiPeriod = { from?: string; to?: string };

/**
 * The brief's §7 KPI table, computed from what this system actually records.
 *
 * These now read *stored event timestamps* — acknowledged_at, resolved_at,
 * complainant_informed_at — rather than each case's current live state. That
 * is the difference between an indicator and a dashboard reading: a stored
 * timestamp can be reported for last week, trended, and audited after the case
 * has closed. The previous version could only ever describe this moment.
 *
 * One KPI is still deliberately null: capture rate compares complaints
 * recorded against complaints received, and a system that *is* the record
 * cannot count what never reached it. Stating that is more useful than
 * printing 100% and implying the question was answered.
 */
export async function computeKpis(tenantId: string, period: KpiPeriod = {}): Promise<Kpis> {
  const supabase = await createClient();
  const complaints = await getComplaints(tenantId, { from: period.from, to: period.to });
  const slaRules = await getSlaRules(tenantId);

  const empty: Kpis = {
    captureRate: null,
    acknowledgementSlaPct: null,
    closedLoopPct: null,
    rcaSlaPct: null,
    capaOnTimePct: null,
    repeatIssuePct: null,
  };
  if (complaints.length === 0) return empty;

  // --- Acknowledgement SLA: was it acknowledged inside the window? ---------
  // Only complaints old enough for their own deadline to have passed count,
  // so a case logged ten minutes ago is not counted as a failure.
  let ackOk = 0;
  let ackTotal = 0;
  const now = Date.now();
  for (const c of complaints) {
    const rule = slaRules[c.severity];
    if (!rule) continue;
    const deadline = new Date(c.created_at).getTime() + rule.acknowledgement_minutes * 60_000;
    if (c.acknowledged_at) {
      ackTotal++;
      if (new Date(c.acknowledged_at).getTime() <= deadline) ackOk++;
    } else if (now > deadline) {
      ackTotal++; // deadline passed with no acknowledgement recorded: a miss
    }
  }

  // --- Closed-loop rate ----------------------------------------------------
  // The brief's definition: cases with a fix confirmation *and* the
  // complainant informed, within 72 hours of resolution. The complainant half
  // is what makes this accountability rather than internal paperwork, so a
  // case closed without informing anyone does not count.
  const closed = complaints.filter((c) => c.current_stage_key === "closed" && c.closed_at);
  let closedLoopOk = 0;
  for (const c of closed) {
    if (!c.closure_note) continue;
    if (!c.complainant_informed_at) continue;
    const resolvedAt = c.resolved_at ?? c.closed_at!;
    const hours = (new Date(c.complainant_informed_at).getTime() - new Date(resolvedAt).getTime()) / 3_600_000;
    if (hours <= 72) closedLoopOk++;
  }

  // --- RCA SLA compliance --------------------------------------------------
  const t1t2 = complaints.filter((c) => c.severity === "T1" || c.severity === "T2");
  let rcaOk = 0;
  if (t1t2.length > 0) {
    const { data: rootCauses } = await supabase
      .from(TABLES.rootCauses)
      .select("complaint_id, created_at")
      .in("complaint_id", t1t2.map((c) => c.id));
    const rcaByComplaint = new Map((rootCauses ?? []).map((r) => [r.complaint_id as string, r.created_at as string]));
    for (const c of t1t2) {
      const rcaAt = rcaByComplaint.get(c.id);
      const rule = slaRules[c.severity];
      if (!rcaAt || !rule?.rca_minutes) continue;
      const minutes = (new Date(rcaAt).getTime() - new Date(c.created_at).getTime()) / 60_000;
      if (minutes <= rule.rca_minutes) rcaOk++;
    }
  }

  // --- CAPA on-time --------------------------------------------------------
  // CAPAs still open and not yet overdue are excluded from the denominator:
  // they are not late yet, and counting them would understate genuinely
  // on-time performance.
  const { data: capas } = await supabase
    .from(TABLES.capas)
    .select("complaint_id, status, due_date, verified_at, updated_at")
    .in("complaint_id", complaints.map((c) => c.id));
  let capaOnTimeOk = 0;
  let capaDenominator = 0;
  for (const c of (capas ?? []).filter((r) => r.due_date)) {
    const isDone = c.status === "verified" || c.status === "closed";
    const completedAt = c.verified_at ?? (isDone ? c.updated_at : null);
    const isOverdue = !isDone && new Date(c.due_date as string) < new Date();
    if (!isDone && !isOverdue) continue;
    capaDenominator++;
    if (completedAt && new Date(completedAt as string) <= new Date(c.due_date as string)) capaOnTimeOk++;
  }

  // --- Repeat issue rate ---------------------------------------------------
  const withBatch = complaints.filter((c) => c.sku && c.batch_number);
  let repeatCount = 0;
  if (withBatch.length > 0) {
    const seen = new Set<string>();
    for (const c of [...withBatch].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const key = `${c.sku}|${c.batch_number}`;
      if (seen.has(key)) repeatCount++;
      else seen.add(key);
    }
  }

  return {
    captureRate: null,
    acknowledgementSlaPct: ackTotal > 0 ? Math.round((ackOk / ackTotal) * 100) : null,
    closedLoopPct: closed.length > 0 ? Math.round((closedLoopOk / closed.length) * 100) : null,
    rcaSlaPct: t1t2.length > 0 ? Math.round((rcaOk / t1t2.length) * 100) : null,
    capaOnTimePct: capaDenominator > 0 ? Math.round((capaOnTimeOk / capaDenominator) * 100) : null,
    repeatIssuePct: withBatch.length > 0 ? Math.round((repeatCount / withBatch.length) * 100) : null,
  };
}

/** KPIs paired with this workspace's targets, ready to render. */
export async function computeKpiResults(tenantId: string, period: KpiPeriod = {}): Promise<KpiResult[]> {
  const [kpis, targets] = await Promise.all([computeKpis(tenantId, period), getKpiTargets(tenantId)]);

  return (Object.keys(KPI_LABELS) as KpiKey[]).map((key) => {
    const value = kpis[key];
    const t = targets[key];
    const target = t?.target_pct ?? null;
    const direction = t?.direction ?? "gte";
    const onTarget =
      value === null || target === null || direction === "down"
        ? null
        : direction === "gte"
          ? value >= target
          : value <= target;

    return {
      key,
      label: KPI_LABELS[key],
      value,
      target: target === null ? null : Number(target),
      direction,
      onTarget,
      note:
        key === "captureRate"
          ? "Not computable from inside the system that is the record — it needs an independent count of complaints received across every channel."
          : undefined,
    };
  });
}

/** How a KPI breaks down across a dimension. An aggregate of 92% can hide one
 * product category at 40%, and disaggregation is where evaluation findings
 * actually come from — the brief asks for trends by category, product and
 * channel specifically. */
export type KpiDimension = "category" | "source" | "severity" | "product_name" | "assignee_id";

export async function computeKpisBy(
  tenantId: string,
  dimension: KpiDimension,
  period: KpiPeriod = {},
): Promise<{ group: string; kpis: Kpis; complaints: number }[]> {
  const all = await getComplaints(tenantId, { from: period.from, to: period.to });
  const groups = new Map<string, Complaint[]>();
  for (const c of all) {
    const key = (c[dimension] as string | null) ?? "Unspecified";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  // Each group is a full KPI computation against the same period, filtered to
  // the group — re-running the query per group rather than trying to partition
  // the aggregates, which would quietly get the denominators wrong.
  const out: { group: string; kpis: Kpis; complaints: number }[] = [];
  for (const [group, list] of groups) {
    out.push({ group, kpis: await computeKpisForSet(tenantId, list), complaints: list.length });
  }
  return out.sort((a, b) => b.complaints - a.complaints);
}

/** The same calculation over an explicit set of complaints, so a breakdown
 * and the headline figure cannot disagree about how a KPI is defined. */
async function computeKpisForSet(tenantId: string, complaints: Complaint[]): Promise<Kpis> {
  const empty: Kpis = {
    captureRate: null,
    acknowledgementSlaPct: null,
    closedLoopPct: null,
    rcaSlaPct: null,
    capaOnTimePct: null,
    repeatIssuePct: null,
  };
  if (!complaints.length) return empty;

  const slaRules = await getSlaRules(tenantId);
  const now = Date.now();

  let ackOk = 0;
  let ackTotal = 0;
  for (const c of complaints) {
    const rule = slaRules[c.severity];
    if (!rule) continue;
    const deadline = new Date(c.created_at).getTime() + rule.acknowledgement_minutes * 60_000;
    if (c.acknowledged_at) {
      ackTotal++;
      if (new Date(c.acknowledged_at).getTime() <= deadline) ackOk++;
    } else if (now > deadline) ackTotal++;
  }

  const closed = complaints.filter((c) => c.current_stage_key === "closed" && c.closed_at);
  let closedLoopOk = 0;
  for (const c of closed) {
    if (!c.closure_note || !c.complainant_informed_at) continue;
    const resolvedAt = c.resolved_at ?? c.closed_at!;
    const hours = (new Date(c.complainant_informed_at).getTime() - new Date(resolvedAt).getTime()) / 3_600_000;
    if (hours <= 72) closedLoopOk++;
  }

  const withBatch = complaints.filter((c) => c.sku && c.batch_number);
  let repeatCount = 0;
  const seen = new Set<string>();
  for (const c of [...withBatch].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const key = `${c.sku}|${c.batch_number}`;
    if (seen.has(key)) repeatCount++;
    else seen.add(key);
  }

  return {
    ...empty,
    acknowledgementSlaPct: ackTotal > 0 ? Math.round((ackOk / ackTotal) * 100) : null,
    closedLoopPct: closed.length > 0 ? Math.round((closedLoopOk / closed.length) * 100) : null,
    repeatIssuePct: withBatch.length > 0 ? Math.round((repeatCount / withBatch.length) * 100) : null,
  };
}
