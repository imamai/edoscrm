/**
 * Pure SLA computation — no server-only imports (same reasoning as
 * lib/domain/tasks.ts), so a future live-updating countdown badge can use
 * this straight from a Client Component. Status is never stored
 * (ARCHITECTURE.md §12): given a complaint's age, current stage and its
 * tenant's SLA rule for its severity, this recomputes on-track/at-risk/
 * overdue on every call.
 */
export type SlaLevel = "good" | "warning" | "danger";
export type SlaStatus = { level: SlaLevel; label: string };

/** Stages that mean "RCA is behind us" — coupled to the seeded default
 * workflow's stage keys (migration 0003); see the caveat in migration 0006. */
const RCA_DONE_STAGES = new Set(["capa", "resolution", "communicate", "closed"]);
const WARNING_THRESHOLD = 0.8;

export function computeSlaStatus(params: {
  createdAt: string;
  currentStageKey: string;
  acknowledgementMinutes: number;
  rcaMinutes: number | null;
  now?: Date;
}): SlaStatus {
  if (params.currentStageKey === "closed") return { level: "good", label: "Closed" };

  const now = params.now ?? new Date();
  const elapsedMinutes = (now.getTime() - new Date(params.createdAt).getTime()) / 60000;

  if (params.currentStageKey === "received") {
    return evaluate(elapsedMinutes, params.acknowledgementMinutes, "Acknowledge");
  }

  if (!RCA_DONE_STAGES.has(params.currentStageKey) && params.rcaMinutes != null) {
    return evaluate(elapsedMinutes, params.rcaMinutes, "RCA");
  }

  return { level: "good", label: "On track" };
}

function evaluate(elapsedMinutes: number, deadlineMinutes: number, what: string): SlaStatus {
  if (elapsedMinutes > deadlineMinutes) {
    return { level: "danger", label: `${what} overdue by ${formatDuration(elapsedMinutes - deadlineMinutes)}` };
  }
  if (elapsedMinutes > deadlineMinutes * WARNING_THRESHOLD) {
    return { level: "warning", label: `${what} due in ${formatDuration(deadlineMinutes - elapsedMinutes)}` };
  }
  return { level: "good", label: "On track" };
}

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
