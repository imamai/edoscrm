import type { Complaint, Severity } from "@/lib/data/complaints";

export type EscalationLevel = "none" | "warning" | "escalate_t2" | "mandatory_rca" | "withdrawal_assessment";

export type EscalationResult = {
  level: EscalationLevel;
  message: string;
  relatedCount: number;
};

const HOUR = 60 * 60 * 1000;

function within(complaints: Complaint[], hours: number, now: number): Complaint[] {
  return complaints.filter((c) => now - new Date(c.created_at).getTime() <= hours * HOUR);
}

/**
 * The brief's §"Escalation procedures" thresholds, computed at render time
 * from the batch siblings a complaint already has — never stored, same
 * philosophy as `computeSlaStatus` (sla.ts / domain/sla.ts): a fact derived
 * from current data, not a field that can drift out of sync with it.
 *
 * Thresholds (all "same product/batch"):
 *  - 2+ within 48h -> warning
 *  - 3+ within 48h -> escalate to T2
 *  - 5+ within 72h -> mandatory RCA
 *  - 10+ within 72h -> withdrawal assessment
 *  - T3: 3+ within 7 days -> escalate to T2
 */
export function computeBatchEscalation(siblings: Complaint[], severity: Severity): EscalationResult {
  const now = Date.now();
  const total = siblings.length + 1; // including the complaint itself

  const within72h = within(siblings, 72, now).length + 1;
  const within48h = within(siblings, 48, now).length + 1;
  const within7d = within(siblings, 24 * 7, now).length + 1;

  if (within72h >= 10) {
    return { level: "withdrawal_assessment", message: `${within72h} complaints for this batch within 72 hours — withdrawal assessment required`, relatedCount: total - 1 };
  }
  if (within72h >= 5) {
    return { level: "mandatory_rca", message: `${within72h} complaints for this batch within 72 hours — RCA is mandatory`, relatedCount: total - 1 };
  }
  if (within48h >= 3) {
    return { level: "escalate_t2", message: `${within48h} complaints for this batch within 48 hours — escalated to T2`, relatedCount: total - 1 };
  }
  if (severity === "T3" && within7d >= 3) {
    return { level: "escalate_t2", message: `${within7d} similar T3 complaints within 7 days — escalated to T2`, relatedCount: total - 1 };
  }
  if (within48h >= 2) {
    return { level: "warning", message: `${within48h} complaints for this batch within 48 hours — watch this batch`, relatedCount: total - 1 };
  }
  return { level: "none", message: "", relatedCount: total - 1 };
}
