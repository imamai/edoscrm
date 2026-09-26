import type { Complaint, Severity } from "@/lib/data/complaints";

export type EscalationLevel = "none" | "warning" | "escalate_t2" | "mandatory_rca" | "withdrawal_assessment";

export type EscalationResult = {
  level: EscalationLevel;
  message: string;
  relatedCount: number;
};

/**
 * The thresholds this calculation uses. Shaped to match the columns on
 * edoscrm_tenant_settings so a workspace's own row can be passed straight in;
 * the defaults are the brief's numbers, used where a workspace has no row.
 */
export type EscalationThresholds = {
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
};

export const BRIEF_THRESHOLDS: EscalationThresholds = {
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
};

const HOUR = 60 * 60 * 1000;

function countWithin(complaints: Complaint[], hours: number, now: number): number {
  // +1 for the complaint these siblings belong to, which is always inside
  // every window by definition.
  return complaints.filter((c) => now - new Date(c.created_at).getTime() <= hours * HOUR).length + 1;
}

/**
 * The brief's §"Escalation procedures" thresholds, computed at render time
 * from the batch siblings a complaint already has — never stored, same
 * philosophy as `computeSlaStatus`: a fact derived from current data, not a
 * field that can drift out of sync with it.
 *
 * The thresholds themselves are per-workspace (§6 asks for them to be
 * configurable) rather than compiled in, because numbers tuned for one product
 * category are wrong for another, and in a multi-tenant product a fixed
 * threshold imposes one company's risk appetite on everyone.
 *
 * Checked strongest-first, so a batch that crosses several thresholds reports
 * the most serious one rather than the first one it happens to match.
 */
export function computeBatchEscalation(
  siblings: Complaint[],
  severity: Severity,
  thresholds: EscalationThresholds = BRIEF_THRESHOLDS,
  now: number = Date.now(),
): EscalationResult {
  const relatedCount = siblings.length;
  const t = thresholds;

  const withdrawal = countWithin(siblings, t.withdrawal_hours, now);
  if (withdrawal >= t.withdrawal_count) {
    return {
      level: "withdrawal_assessment",
      message: `${withdrawal} complaints for this batch within ${t.withdrawal_hours} hours — withdrawal assessment required`,
      relatedCount,
    };
  }

  const rca = countWithin(siblings, t.mandatory_rca_hours, now);
  if (rca >= t.mandatory_rca_count) {
    return {
      level: "mandatory_rca",
      message: `${rca} complaints for this batch within ${t.mandatory_rca_hours} hours — RCA is mandatory`,
      relatedCount,
    };
  }

  const escalate = countWithin(siblings, t.escalate_hours, now);
  if (escalate >= t.escalate_count) {
    return {
      level: "escalate_t2",
      message: `${escalate} complaints for this batch within ${t.escalate_hours} hours — escalated to T2`,
      relatedCount,
    };
  }

  if (severity === "T3") {
    const t3 = countWithin(siblings, t.t3_escalate_days * 24, now);
    if (t3 >= t.t3_escalate_count) {
      return {
        level: "escalate_t2",
        message: `${t3} similar T3 complaints within ${t.t3_escalate_days} days — escalated to T2`,
        relatedCount,
      };
    }
  }

  const warn = countWithin(siblings, t.warn_hours, now);
  if (warn >= t.warn_count) {
    return {
      level: "warning",
      message: `${warn} complaints for this batch within ${t.warn_hours} hours — watch this batch`,
      relatedCount,
    };
  }

  return { level: "none", message: "", relatedCount };
}
