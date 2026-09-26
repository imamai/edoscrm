import { describe, expect, it } from "vitest";
import { computeSlaStatus } from "./sla";

/**
 * SLA status decides what the dashboard shows as overdue and what the hourly
 * job chases people about, so the boundaries matter: one minute either side of
 * a deadline is the difference between silence and an escalation email.
 */

const NOW = new Date("2026-09-26T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const T1 = { acknowledgementMinutes: 60, rcaMinutes: 2880, resolutionPlanMinutes: null };
const T2 = { acknowledgementMinutes: 1440, rcaMinutes: 7200, resolutionPlanMinutes: 2880 };
const T3 = { acknowledgementMinutes: 1440, rcaMinutes: null, resolutionPlanMinutes: null };

describe("computeSlaStatus", () => {
  it("treats a closed case as settled, whatever its age", () => {
    const status = computeSlaStatus({ createdAt: hoursAgo(5000), currentStageKey: "closed", ...T1, now: NOW });
    expect(status).toEqual({ level: "good", label: "Closed" });
  });

  it("is on track inside the acknowledgement window", () => {
    expect(computeSlaStatus({ createdAt: hoursAgo(0.5), currentStageKey: "received", ...T1, now: NOW }).level).toBe("good");
  });

  it("warns as the acknowledgement deadline approaches", () => {
    // 80% of a 60-minute deadline is 48 minutes.
    expect(computeSlaStatus({ createdAt: hoursAgo(0.9), currentStageKey: "received", ...T1, now: NOW }).level).toBe("warning");
  });

  it("is overdue past the acknowledgement deadline", () => {
    const status = computeSlaStatus({ createdAt: hoursAgo(2), currentStageKey: "received", ...T1, now: NOW });
    expect(status.level).toBe("danger");
    expect(status.label).toContain("Acknowledge overdue");
  });

  it("stops the acknowledgement clock once the case has been acknowledged", () => {
    // Two hours old against a one-hour deadline, but acknowledged — so this is
    // not an acknowledgement breach, whatever the elapsed time says.
    const status = computeSlaStatus({
      createdAt: hoursAgo(2),
      currentStageKey: "received",
      ...T1,
      acknowledgedAt: hoursAgo(1.9),
      now: NOW,
    });
    expect(status.level).not.toBe("danger");
  });

  it("applies T2's separate resolution-plan deadline before RCA", () => {
    // 50 hours old: past the 48-hour plan deadline, well inside the 5-day RCA.
    const status = computeSlaStatus({ createdAt: hoursAgo(50), currentStageKey: "triage", ...T2, now: NOW });
    expect(status.level).toBe("danger");
    expect(status.label).toContain("Resolution plan overdue");
  });

  it("moves on to the RCA deadline once investigation has started", () => {
    const status = computeSlaStatus({ createdAt: hoursAgo(50), currentStageKey: "investigating", ...T2, now: NOW });
    expect(status.label).not.toContain("Resolution plan");
  });

  it("flags an RCA breach", () => {
    // T1's RCA deadline is 48 hours.
    const status = computeSlaStatus({ createdAt: hoursAgo(72), currentStageKey: "investigating", ...T1, now: NOW });
    expect(status.level).toBe("danger");
    expect(status.label).toContain("RCA overdue");
  });

  it("never reports an RCA breach for a severity with no RCA deadline", () => {
    // T3 deliberately has none: the brief asks only that a minor complaint be
    // logged, acknowledged and reviewed weekly. A null here must mean "no
    // deadline", not "overdue immediately".
    const status = computeSlaStatus({ createdAt: hoursAgo(5000), currentStageKey: "investigating", ...T3, now: NOW });
    expect(status.level).toBe("good");
  });

  it("stops measuring once the case is past RCA", () => {
    for (const stage of ["capa", "resolution", "communicate"]) {
      const status = computeSlaStatus({ createdAt: hoursAgo(5000), currentStageKey: stage, ...T1, now: NOW });
      expect(status.level).toBe("good");
    }
  });
});
