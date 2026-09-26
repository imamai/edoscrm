import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3, Layers, PieChart, TrendingUp } from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { getComplaints, type Channel } from "@/lib/data/complaints";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { AreaChart, BarChart, CHART, ChartCard, ChartEmpty, DonutChart, wholeNumber, type Point } from "@/components/charts/charts";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata: Metadata = { title: "Analytics" };

type PeriodKey = "today" | "week" | "month" | "last30" | "year" | "all";
const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "last30", label: "Last 30 days" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];
const DEFAULT_PERIOD: PeriodKey = "last30";

function periodRange(period: PeriodKey): { from: Date | null; to: Date } {
  const now = new Date();
  const to = now;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (period) {
    case "today":
      return { from: startOfDay(now), to };
    case "week": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - from.getDay());
      return { from, to };
    }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case "last30": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { from, to };
    }
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to };
    case "all":
    default:
      return { from: null, to };
  }
}

/** Day buckets across the range; monthly buckets once it's wider than ~9 weeks. */
function bucket(dates: Date[], from: Date, to: Date): Point[] {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const monthly = days > 62;
  const key = (d: Date) => (monthly ? `${d.getFullYear()}-${d.getMonth()}` : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  const index = new Map<string, number>();
  const points: Point[] = [];

  const cursor = new Date(from.getFullYear(), from.getMonth(), monthly ? 1 : from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= end) {
    const k = key(cursor);
    if (!index.has(k)) {
      index.set(k, points.length);
      points.push({ label: monthly ? MONTHS[cursor.getMonth()] : `${cursor.getDate()} ${MONTHS[cursor.getMonth()]}`, value: 0 });
    }
    if (monthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  for (const d of dates) {
    const at = index.get(key(d));
    if (at !== undefined) points[at].value += 1;
  }
  return points;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");
  const sp = await searchParams;
  const period = (PERIODS.some((p) => p.value === sp.period) ? sp.period : DEFAULT_PERIOD) as PeriodKey;
  const { from, to } = periodRange(period);
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "Last 30 days";

  const [all, workflow, slaRules] = await Promise.all([
    getComplaints(session.tenant.id),
    getDefaultWorkflowVersion(session.tenant.id),
    getSlaRules(session.tenant.id),
  ]);
  const complaints = from ? all.filter((c) => new Date(c.created_at) >= from) : all;
  const stages = workflow?.definition.stages ?? [];

  const closed = complaints.filter((c) => c.current_stage_key === "closed");
  let breached = 0;
  for (const c of complaints) {
    if (c.current_stage_key === "closed") continue;
    const rule = slaRules[c.severity];
    if (!rule) continue;
    const status = computeSlaStatus({ createdAt: c.created_at, currentStageKey: c.current_stage_key, acknowledgementMinutes: rule.acknowledgement_minutes, rcaMinutes: rule.rca_minutes });
    if (status.level === "danger") breached++;
  }
  const t1Count = complaints.filter((c) => c.severity === "T1").length;
  const glance = [
    { label: "Complaints", value: complaints.length },
    { label: "Closed", value: closed.length },
    { label: "T1", value: t1Count },
    { label: "SLA breached", value: breached },
  ];

  const earliest = complaints.reduce<Date | null>((min, c) => {
    const d = new Date(c.created_at);
    return !min || d < min ? d : min;
  }, null);
  const trendFrom = from ?? earliest ?? to;
  const trendPoints = bucket(complaints.map((c) => new Date(c.created_at)), trendFrom, to);

  const bySeverity = { T1: 0, T2: 0, T3: 0 };
  for (const c of complaints) bySeverity[c.severity]++;
  const severitySlices = [
    { label: "T1 — Critical", value: bySeverity.T1, color: CHART.danger },
    { label: "T2 — Major", value: bySeverity.T2, color: CHART.secondary },
    { label: "T3 — Minor", value: bySeverity.T3, color: CHART.primary },
  ];

  const byChannel = new Map<Channel, number>();
  for (const c of complaints) byChannel.set(c.source, (byChannel.get(c.source) ?? 0) + 1);
  const channelOrder: Channel[] = ["web", "phone", "email", "whatsapp", "walk_in", "internal"];
  const channelBars = channelOrder.filter((ch) => (byChannel.get(ch) ?? 0) > 0).map((ch, i) => ({ label: ch, value: byChannel.get(ch) ?? 0, color: CHART.series[i % CHART.series.length] }));

  const byStage = new Map<string, number>();
  for (const c of complaints) byStage.set(c.current_stage_key, (byStage.get(c.current_stage_key) ?? 0) + 1);
  const stageBars = stages.map((s) => ({ label: s.label, value: byStage.get(s.key) ?? 0 }));

  const href = (p: PeriodKey) => (p === DEFAULT_PERIOD ? "/analytics" : `/analytics?period=${p}`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Analytics</h1>
          <p className="text-sm text-ink-faint">Trends over time — pick a period to narrow every chart below.</p>
        </div>
        <div className="flex rounded-lg border border-border p-0.5">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={href(p.value)}
              className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors", period === p.value ? "bg-brand text-brand-ink" : "text-ink-faint hover:text-ink")}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-medium text-ink-faint">{periodLabel} at a glance</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {glance.map((g) => (
            <div key={g.label}>
              <dt className="text-xs text-ink-faint">{g.label}</dt>
              <dd className="tnum mt-0.5 text-lg font-semibold text-ink">{g.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard icon={TrendingUp} title="Complaints over time" subtitle={periodLabel} className="lg:col-span-2">
          {trendPoints.some((p) => p.value > 0) ? (
            <AreaChart points={trendPoints} format={wholeNumber} label={`Complaints, ${periodLabel.toLowerCase()}`} />
          ) : (
            <ChartEmpty>Nothing logged {periodLabel.toLowerCase()}.</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard icon={PieChart} title="By severity" subtitle={periodLabel}>
          {complaints.length > 0 ? (
            <DonutChart slices={severitySlices} centre={String(complaints.length)} format={wholeNumber} label="By severity" />
          ) : (
            <ChartEmpty>No complaints in this period.</ChartEmpty>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard icon={BarChart3} title="By channel" subtitle={periodLabel}>
          {channelBars.length > 0 ? <BarChart bars={channelBars} format={wholeNumber} label="By channel" /> : <ChartEmpty>No complaints in this period.</ChartEmpty>}
        </ChartCard>
        <ChartCard icon={Layers} title="By stage" subtitle={periodLabel}>
          {stageBars.some((b) => b.value > 0) ? <BarChart bars={stageBars} format={wholeNumber} label="By stage" /> : <ChartEmpty>No complaints in this period.</ChartEmpty>}
        </ChartCard>
      </div>
    </div>
  );
}
