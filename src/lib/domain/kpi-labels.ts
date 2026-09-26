// Plain data, no "server-only" — the settings screen is a client component and
// needs the indicator names without pulling the whole KPI computation (and its
// Supabase client) into the browser.

export type KpiKey =
  | "captureRate"
  | "acknowledgementSlaPct"
  | "closedLoopPct"
  | "rcaSlaPct"
  | "capaOnTimePct"
  | "repeatIssuePct";

export const KPI_LABELS: Record<KpiKey, string> = {
  captureRate: "Complaint capture rate",
  acknowledgementSlaPct: "Acknowledgement SLA",
  closedLoopPct: "Closed-loop rate",
  rcaSlaPct: "RCA SLA compliance",
  capaOnTimePct: "CAPA on-time completion",
  repeatIssuePct: "Repeat issue rate",
};
