import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { StatCard } from "@/components/dashboard/stat-card";
import { SeverityBadge } from "@/components/complaints/severity-badge";
import { ChannelBadge } from "@/components/complaints/channel-badge";
import { AreaChart, BarChart, CHART, ChartCard, ChartEmpty, DonutChart, wholeNumber, type Point } from "@/components/charts/charts";
import { formatDateTime } from "@/lib/utils";
import type { Channel } from "@/lib/data/complaints";

export const metadata: Metadata = { title: "Dashboard" };

const EVENT_LABEL: Record<string, string> = {
  "complaint.created": "Complaint logged",
  "stage.changed": "Stage advanced",
  "investigation.recorded": "Investigation recorded",
  "root_cause.recorded": "Root cause classified",
  "capa.recorded": "CAPA recorded",
  "complaint.closed": "Case closed",
  "assignment.changed": "Reassigned",
  "severity.changed": "Severity changed",
};

const DAYS = 14;

/** Last DAYS calendar days, oldest first — complaints logged per day. */
function dailyCounts(createdAts: string[]): Point[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const iso of createdAts) {
    const key = iso.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([key, value]) => ({
    label: new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    value,
  }));
}

export default async function DashboardPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const [data, workflow] = await Promise.all([getDashboardData(session.tenant.id), getDefaultWorkflowVersion(session.tenant.id)]);
  const stages = workflow?.definition.stages ?? [];

  const trendPoints = dailyCounts(data.complaints.map((c) => c.created_at));

  const bySeverity = { T1: 0, T2: 0, T3: 0 };
  for (const c of data.complaints) bySeverity[c.severity]++;
  const severitySlices = [
    { label: "T1 — Critical", value: bySeverity.T1, color: CHART.danger },
    { label: "T2 — Major", value: bySeverity.T2, color: CHART.secondary },
    { label: "T3 — Minor", value: bySeverity.T3, color: CHART.primary },
  ];

  const byChannel = new Map<Channel, number>();
  for (const c of data.complaints) byChannel.set(c.source, (byChannel.get(c.source) ?? 0) + 1);
  const channelOrder: Channel[] = ["web", "phone", "email", "whatsapp", "social", "sales_rep", "walk_in", "internal"];
  const channelBars = channelOrder
    .filter((ch) => (byChannel.get(ch) ?? 0) > 0)
    .map((ch, i) => ({ label: ch, value: byChannel.get(ch) ?? 0, color: CHART.series[i % CHART.series.length] }));

  const byStage = new Map<string, number>();
  for (const c of data.complaints) byStage.set(c.current_stage_key, (byStage.get(c.current_stage_key) ?? 0) + 1);
  const stageBars = stages.map((s) => ({ label: s.label, value: byStage.get(s.key) ?? 0 }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{session.tenant.name}</h1>
        <p className="text-sm text-ink-faint">What needs attention right now, and how the pipeline is moving.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Open complaints" value={data.openCount} icon={ClipboardList} tone="brand" />
        <StatCard label="T1 open" value={data.t1Count} icon={AlertTriangle} tone={data.t1Count > 0 ? "danger" : "neutral"} />
        <StatCard label="SLA overdue" value={data.overdueCount} icon={Clock} tone={data.overdueCount > 0 ? "danger" : "neutral"} />
        <StatCard label="Tasks overdue" value={data.tasksOverdueCount} icon={CheckCircle2} tone={data.tasksOverdueCount > 0 ? "warning" : "neutral"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard icon={ClipboardList} title="Complaints logged" subtitle={`Last ${DAYS} days`} action={{ href: "/analytics", label: "Details" }} className="lg:col-span-2">
          {trendPoints.some((p) => p.value > 0) ? (
            <AreaChart points={trendPoints} format={wholeNumber} label={`Complaints logged, last ${DAYS} days`} />
          ) : (
            <ChartEmpty>Nothing logged in the last {DAYS} days.</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard icon={AlertTriangle} title="By severity" subtitle="All time" action={{ href: "/analytics", label: "Details" }}>
          {data.complaints.length > 0 ? (
            <DonutChart slices={severitySlices} centre={String(data.complaints.length)} format={wholeNumber} label="Complaints by severity" />
          ) : (
            <ChartEmpty>No complaints logged yet.</ChartEmpty>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard icon={ClipboardList} title="By channel" subtitle="Every complaint, whichever door it came through">
          {channelBars.length > 0 ? (
            <BarChart bars={channelBars} format={wholeNumber} label="Complaints by channel" />
          ) : (
            <ChartEmpty>No complaints logged yet.</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard icon={ClipboardList} title="Pipeline by stage" subtitle="Where things are stuck" action={{ href: "/complaints", label: "Open pipeline" }}>
          {stageBars.some((b) => b.value > 0) ? (
            <BarChart bars={stageBars} format={wholeNumber} label="Complaints by stage" />
          ) : (
            <ChartEmpty>No complaints logged yet.</ChartEmpty>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Needs attention</h2>
          {data.attention.length === 0 ? (
            <p className="text-sm text-ink-faint">Nothing at risk or overdue right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.attention.map(({ complaint, reason }) => (
                <Link
                  key={complaint.id}
                  href={`/complaints/${complaint.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-2 hover:bg-background"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-ink">{complaint.title}</span>
                    <span className="text-xs text-ink-faint">{complaint.case_number}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      <ChannelBadge channel={complaint.source} />
                      <SeverityBadge severity={complaint.severity} />
                    </div>
                    <span className={reason.includes("overdue") ? "text-xs text-danger" : "text-xs text-warning"}>{reason}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Recent activity</h2>
          {data.recentEvents.length === 0 ? (
            <p className="text-sm text-ink-faint">Nothing has happened yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {data.recentEvents.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">
                    <Link href={`/complaints/${event.complaint_id}`} className="text-brand hover:underline">
                      {event.case_number}
                    </Link>{" "}
                    — {EVENT_LABEL[event.event_type] ?? event.event_type}
                  </span>
                  <span className="shrink-0 text-xs text-ink-faint">{formatDateTime(event.created_at)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
