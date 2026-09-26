import { describe, expect, it } from "vitest";
import { computeBatchEscalation, BRIEF_THRESHOLDS } from "./escalation";
import type { Complaint, Severity } from "@/lib/data/complaints";

/**
 * The escalation thresholds are the rules most worth pinning down: they decide
 * when a batch stops being a handful of complaints and becomes a product
 * safety question, and they were previously protected only by memory. The
 * numbers here are the brief's own.
 */

const NOW = new Date("2026-09-26T12:00:00.000Z").getTime();

/** A sibling complaint logged `hoursAgo` before NOW. */
function sibling(hoursAgo: number): Complaint {
  return {
    created_at: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
  } as Complaint;
}

function evaluate(siblings: Complaint[], severity: Severity = "T2") {
  return computeBatchEscalation(siblings, severity, BRIEF_THRESHOLDS, NOW);
}

describe("computeBatchEscalation", () => {
  it("says nothing about a lone complaint", () => {
    expect(evaluate([]).level).toBe("none");
  });

  it("warns at two complaints inside 48 hours", () => {
    // One sibling plus the complaint itself is two.
    expect(evaluate([sibling(1)]).level).toBe("warning");
  });

  it("does not warn when the second complaint is outside the 48-hour window", () => {
    expect(evaluate([sibling(49)]).level).toBe("none");
  });

  it("escalates to T2 at three complaints inside 48 hours", () => {
    expect(evaluate([sibling(1), sibling(2)]).level).toBe("escalate_t2");
  });

  it("makes RCA mandatory at five complaints inside 72 hours", () => {
    const siblings = [sibling(60), sibling(62), sibling(64), sibling(66)];
    expect(evaluate(siblings).level).toBe("mandatory_rca");
  });

  it("requires a withdrawal assessment at ten complaints inside 72 hours", () => {
    const siblings = Array.from({ length: 9 }, (_, i) => sibling(i + 1));
    expect(evaluate(siblings).level).toBe("withdrawal_assessment");
  });

  it("reports the most serious threshold crossed, not the first one matched", () => {
    // Ten inside 72h also satisfies the warning and escalation thresholds;
    // reporting "watch this batch" for a recall candidate would be a
    // dangerous understatement.
    const siblings = Array.from({ length: 9 }, (_, i) => sibling(i + 1));
    expect(evaluate(siblings).level).toBe("withdrawal_assessment");
  });

  it("escalates T3 complaints at three inside seven days", () => {
    // Outside the 48-hour window, so this can only be the T3 rule.
    const siblings = [sibling(24 * 3), sibling(24 * 5)];
    expect(evaluate(siblings, "T3").level).toBe("escalate_t2");
    // The same pattern at T2 is not escalated by the seven-day rule.
    expect(evaluate(siblings, "T2").level).toBe("none");
  });

  it("counts only siblings inside each window", () => {
    // Four old complaints and one recent: five in total, but only two are
    // inside 72 hours, so this is not a mandatory RCA.
    const siblings = [sibling(200), sibling(300), sibling(400), sibling(1)];
    expect(evaluate(siblings).level).toBe("warning");
  });

  it("honours a workspace's own thresholds", () => {
    const strict = { ...BRIEF_THRESHOLDS, warn_count: 2, escalate_count: 2, escalate_hours: 48 };
    expect(computeBatchEscalation([sibling(1)], "T2", strict, NOW).level).toBe("escalate_t2");
  });

  it("reports how many siblings were involved", () => {
    expect(evaluate([sibling(1), sibling(2)]).relatedCount).toBe(2);
  });
});
