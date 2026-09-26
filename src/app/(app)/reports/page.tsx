import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { getComplaints, type Channel } from "@/lib/data/complaints";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { StatCard } from "@/components/dashboard/stat-card";
import { ChannelBadge } from "@/components/complaints/channel-badge";
import { computeKpis } from "@/lib/data/kpis";

export const metadata: Metadata = { title: "Reports" };

/**
 * First cut of Reports (ARCHITECTURE.md §14 step 7) — the totals a manager
 * asks for first: volume, where it's stuck, how it's breaching SLA, and
 * which channel it arrived on. No period filter yet (no ReportPeriod
 * infrastructure exists in this codebase); everything below is all-time.
 * A natural next step once there's more than one report worth comparing
 * periods against.
 */
export default async function ReportsPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const [complaints, workflow, slaRules, kpis] = await Promise.all([
    getComplaints(session.tenant.id),
    getDefaultWorkflowVersion(session.tenant.id),
    getSlaRules(session.tenant.id),
    computeKpis(session.tenant.id),
  ]);

  const stages = workflow?.definition.stages ?? [];
  const stageLabel = new Map(stages.map((s) => [s.key, s.label]));
  const open = complaints.filter((c) => c.current_stage_key !== "closed");
  const closed = complaints.length - open.length;

  let breached = 0;
  for (const c of open) {
    const rule = slaRules[c.severity];
    if (!rule) continue;
    const status = computeSlaStatus({
      createdAt: c.created_at,
      currentStageKey: c.current_stage_key,
      acknowledgementMinutes: rule.acknowledgement_minutes,
      rcaMinutes: rule.rca_minutes,
    });
    if (status.level === "danger") breached++;
  }

  const byStage = new Map<string, number>();
  for (const c of complaints) byStage.set(c.current_stage_key, (byStage.get(c.current_stage_key) ?? 0) + 1);

  const bySeverity = { T1: 0, T2: 0, T3: 0 };
  for (const c of complaints) bySeverity[c.severity]++;

  const byChannel = new Map<Channel, number>();
  for (const c of complaints) byChannel.set(c.source, (byChannel.get(c.source) ?? 0) + 1);
  const channelOrder: Channel[] = ["web", "phone", "email", "whatsapp", "walk_in", "internal"];

  const maxStageCount = Math.max(1, ...byStage.values());
  const maxChannelCount = Math.max(1, ...byChannel.values());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Reports</h1>
        <p className="text-sm text-ink-faint">All-time totals across every complaint, whichever channel it arrived on.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total complaints" value={complaints.length} />
        <StatCard label="Open" value={open.length} />
        <StatCard label="Closed" value={closed} />
        <StatCard label="SLA breached" value={breached} tone={breached > 0 ? "danger" : "neutral"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">By stage</h2>
          {stages.length === 0 ? (
            <p className="text-sm text-ink-faint">No workflow configured yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {stages.map((s) => {
                const count = byStage.get(s.key) ?? 0;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm text-ink-faint">{s.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(count / maxStageCount) * 100}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">By severity</h2>
          <div className="flex flex-col gap-2">
            {(["T1", "T2", "T3"] as const).map((sev) => (
              <div key={sev} className="flex items-center justify-between text-sm">
                <span className="text-ink-faint">{sev}</span>
                <span className="tabular-nums text-ink">{bySeverity[sev]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink">Brief §7 KPIs</h2>
        <p className="mb-3 text-xs text-ink-faint">
          Capture rate can&rsquo;t be computed from inside this system alone — it would need an independent count of
          complaints actually received to compare against. Acknowledgement SLA reads current live status, not a
          separately-recorded acknowledgement timestamp.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiTile label="Capture rate" value={kpis.captureRate} note="Not measurable here" />
          <KpiTile label="Acknowledgement SLA" value={kpis.acknowledgementSlaPct} target={100} />
          <KpiTile label="Closed-loop rate" value={kpis.closedLoopPct} target={85} />
          <KpiTile label="RCA SLA (T1/T2)" value={kpis.rcaSlaPct} target={100} />
          <KpiTile label="CAPA on-time" value={kpis.capaOnTimePct} target={100} />
          <KpiTile label="Repeat issue rate" value={kpis.repeatIssuePct} lowerIsBetter />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">By channel</h2>
        <p className="mb-3 text-xs text-ink-faint">
          Every complaint converges on this one workspace regardless of how it arrived — this is the split.
        </p>
        <div className="flex flex-col gap-2">
          {channelOrder
            .filter((ch) => (byChannel.get(ch) ?? 0) > 0)
            .map((ch) => {
              const count = byChannel.get(ch) ?? 0;
              return (
                <div key={ch} className="flex items-center gap-3">
                  <ChannelBadge channel={ch} className="w-28 shrink-0" />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(count / maxChannelCount) * 100}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink">{count}</span>
                </div>
              );
            })}
          {complaints.length === 0 && <p className="text-sm text-ink-faint">No complaints logged yet.</p>}
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  target,
  note,
  lowerIsBetter,
}: {
  label: string;
  value: number | null;
  target?: number;
  note?: string;
  lowerIsBetter?: boolean;
}) {
  const onTarget = value !== null && target !== undefined && (lowerIsBetter ? value <= target : value >= target);
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <p className="text-xs font-medium text-ink-faint">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${value === null ? "text-ink-faint" : onTarget ? "text-good" : "text-ink"}`}>
        {value === null ? "—" : `${value}%`}
      </p>
      <p className="text-[11px] text-ink-faint">{note ?? (target !== undefined ? `Target ${lowerIsBetter ? "≤" : "≥"} ${target}%` : "Trend")}</p>
    </div>
  );
}
