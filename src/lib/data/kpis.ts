import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { getComplaints } from "@/lib/data/complaints";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { stageDatesFromEvents, type ComplaintEvent } from "@/lib/data/complaints";

export type Kpis = {
  captureRate: null; // brief note: not measurable from inside this system alone
  acknowledgementSlaPct: number | null;
  closedLoopPct: number | null;
  rcaSlaPct: number | null;
  capaOnTimePct: number | null;
  repeatIssuePct: number | null;
};

/**
 * The brief's §7 KPI table, computed from what this system actually
 * records. Two are genuinely approximate and said so in the report rather
 * than presented as more precise than the data supports:
 *  - Acknowledgement SLA reads the *current* live SLA status (there is no
 *    separate "acknowledged at" timestamp recorded anywhere yet).
 *  - Capture rate can't be computed at all from inside the system that IS
 *    the record — it would need a second, independent count of complaints
 *    actually received across every channel to compare against.
 */
export async function computeKpis(tenantId: string): Promise<Kpis> {
  const supabase = await createClient();
  const complaints = await getComplaints(tenantId);
  const slaRules = await getSlaRules(tenantId);

  if (complaints.length === 0) {
    return { captureRate: null, acknowledgementSlaPct: null, closedLoopPct: null, rcaSlaPct: null, capaOnTimePct: null, repeatIssuePct: null };
  }

  // Acknowledgement SLA — current live status, not "danger".
  let ackOk = 0;
  let ackTotal = 0;
  for (const c of complaints) {
    const rule = slaRules[c.severity];
    if (!rule) continue;
    ackTotal++;
    const status = computeSlaStatus({
      createdAt: c.created_at,
      currentStageKey: c.current_stage_key,
      acknowledgementMinutes: rule.acknowledgement_minutes,
      rcaMinutes: rule.rca_minutes,
    });
    if (status.level !== "danger") ackOk++;
  }

  // Closed-loop rate — closed within 72h of entering the second-to-last
  // ("resolution"-equivalent) stage, with a written confirmation on file.
  const closed = complaints.filter((c) => c.current_stage_key === "closed" && c.closed_at);
  let closedLoopOk = 0;
  if (closed.length > 0) {
    const { data: allEvents } = await supabase
      .from(TABLES.complaintEvents)
      .select("complaint_id, event_type, payload, created_at")
      .in("complaint_id", closed.map((c) => c.id));
    const eventsByComplaint = new Map<string, ComplaintEvent[]>();
    for (const e of allEvents ?? []) {
      const list = eventsByComplaint.get(e.complaint_id as string) ?? [];
      list.push(e as ComplaintEvent);
      eventsByComplaint.set(e.complaint_id as string, list);
    }
    for (const c of closed) {
      if (!c.closure_note) continue;
      const dates = stageDatesFromEvents(eventsByComplaint.get(c.id) ?? []);
      const stageKeys = Object.keys(dates).filter((k) => k !== "closed");
      const lastStageEnteredAt = stageKeys.map((k) => dates[k]).sort().pop();
      if (!lastStageEnteredAt) continue;
      const hours = (new Date(c.closed_at!).getTime() - new Date(lastStageEnteredAt).getTime()) / 3_600_000;
      if (hours <= 72) closedLoopOk++;
    }
  }

  // RCA SLA compliance — T1/T2 complaints with a root cause recorded
  // within the severity's rca_minutes window.
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

  // CAPA on-time — verified/closed CAPAs whose completion landed by their
  // due date; CAPAs still open/in-progress and not yet overdue are excluded
  // from the denominator (they're not "late" yet, so counting them against
  // the rate would understate genuinely on-time performance).
  const { data: capas } = await supabase
    .from(TABLES.capas)
    .select("complaint_id, status, due_date, verified_at, updated_at")
    .in("complaint_id", complaints.map((c) => c.id));
  const dueCapas = (capas ?? []).filter((c) => c.due_date);
  let capaOnTimeOk = 0;
  let capaDenominator = 0;
  for (const c of dueCapas) {
    const isDone = c.status === "verified" || c.status === "closed";
    const completedAt = c.verified_at ?? (isDone ? c.updated_at : null);
    const isOverdue = !isDone && new Date(c.due_date as string) < new Date();
    if (!isDone && !isOverdue) continue; // not due yet, not counted either way
    capaDenominator++;
    if (completedAt && new Date(completedAt as string) <= new Date(c.due_date as string)) capaOnTimeOk++;
  }

  // Repeat issue rate — complaints that are not the first one recorded for
  // their SKU/batch.
  const withBatch = complaints.filter((c) => c.sku && c.batch_number);
  let repeatCount = 0;
  if (withBatch.length > 0) {
    const seen = new Map<string, string>(); // "sku|batch" -> earliest created_at seen so far
    const sorted = [...withBatch].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const c of sorted) {
      const key = `${c.sku}|${c.batch_number}`;
      if (seen.has(key)) repeatCount++;
      else seen.set(key, c.created_at);
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
