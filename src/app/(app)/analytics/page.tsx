import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3, Gauge, Layers, PieChart, TrendingUp } from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { getComplaints, type Channel } from "@/lib/data/complaints";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { getSlaRules } from "@/lib/data/sla";
import { computeKpis } from "@/lib/data/kpis";
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

/** A custom from/to pair wins over the period chips, but only when both
 * dates are real and the right way round — one date on its own is half an
 * instruction, so it's ignored rather than guessed at (edos-poa's own rule
 * for the same filter). */
function customRange(fromValue?: string, toValue?: string) {
  const asDay = (v?: string) => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(`${v}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const f = asDay(fromValue);
  const t = asDay(toValue);
  if (!f || !t || f > t) return null;
  return {
    from: new Date(f.getFullYear(), f.getMonth(), f.getDate()),
    to: new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999),
    fromValue: fromValue!,
    toValue: toValue!,
  };
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");
  const sp = await searchParams;
  const custom = customRange(sp.from, sp.to);
  const period = (PERIODS.some((p) => p.value === sp.period) ? sp.period : DEFAULT_PERIOD) as PeriodKey;
  const range = custom ? { from: custom.from, to: custom.to } : periodRange(period);
  const { from, to } = range;
  const dayMonth = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const periodLabel = custom ? `${dayMonth(custom.from)} – ${dayMonth(custom.to)}` : (PERIODS.find((p) => p.value === period)?.label ?? "Last 30 days");

  const [all, workflow, slaRules, kpis] = await Promise.all([
    getComplaints(session.tenant.id),
    getDefaultWorkflowVersion(session.tenant.id),
    getSlaRules(session.tenant.id),
    computeKpis(session.tenant.id),
  ]);
  const complaints = all.filter((c) => {
    const at = new Date(c.created_at);
    if (from && at < from) return false;
    if (custom && at > to) return false;
    return true;
  });
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

  const kpiTiles: { label: string; value: number | null; target?: number; note?: string; lowerIsBetter?: boolean }[] = [
    { label: "Capture rate", value: kpis.captureRate, note: "Not measurable from inside this system" },
    { label: "Acknowledgement SLA", value: kpis.acknowledgementSlaPct, target: 100 },
    { label: "Closed-loop rate", value: kpis.closedLoopPct, target: 85 },
    { label: "RCA SLA (T1/T2)", value: kpis.rcaSlaPct, target: 100 },
    { label: "CAPA on-time", value: kpis.capaOnTimePct, target: 100 },
    { label: "Repeat issue rate", value: kpis.repeatIssuePct, lowerIsBetter: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Analytics</h1>
          <p className="text-sm text-ink-faint">Trends over time — pick a period, or set your own dates, to narrow every chart below.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {PERIODS.map((p) => (
              <Link
                key={p.value}
                href={href(p.value)}
                className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors", !custom && period === p.value ? "bg-brand text-brand-ink" : "text-ink-faint hover:text-ink")}
              >
                {p.label}
              </Link>
            ))}
          </div>

          {/* A plain GET form: no state to keep, and the dates end up in the
              address bar, so a custom range is a link someone can send on. */}
          <form method="get" action="/analytics" className="flex flex-wrap items-center gap-1.5">
            <label className="sr-only" htmlFor="from">
              From
            </label>
            <input id="from" type="date" name="from" defaultValue={custom?.fromValue ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none" />
            <span className="text-xs text-ink-faint">to</span>
            <label className="sr-only" htmlFor="to">
              To
            </label>
            <input id="to" type="date" name="to" defaultValue={custom?.toValue ?? ""} className="h-9 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none" />
            <button
              type="submit"
              className={cn("h-9 rounded-lg border px-3 text-xs font-medium transition-colors", custom ? "border-brand bg-brand text-brand-ink" : "border-border text-ink-faint hover:border-brand hover:text-brand")}
            >
              {custom ? "Applied" : "Apply"}
            </button>
            {custom && (
              <Link href="/analytics" className="h-9 px-2 text-xs font-medium leading-9 text-ink-faint hover:text-ink">
                Clear
              </Link>
            )}
          </form>
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

      {/* Quality KPIs sit here with the rest of the charts rather than on
          Reports — Reports is for tables you download, this is for reading
          performance at a glance. All-time by definition: a closed-loop or
          repeat-issue rate measured over one week says very little. */}
      <ChartCard icon={Gauge} title="Quality KPIs" subtitle="All time">
        <p className="mb-4 text-xs text-ink-faint">
          Capture rate can&rsquo;t be computed from inside the system that is the record. Acknowledgement SLA reads current
          live status, not a separately-recorded acknowledgement timestamp.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kpiTiles.map((t) => {
            const onTarget = t.value !== null && t.target !== undefined && (t.lowerIsBetter ? t.value <= t.target : t.value >= t.target);
            return (
              <div key={t.label} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-ink-faint">{t.label}</p>
                <p className={cn("text-xl font-semibold tabular-nums", t.value === null ? "text-ink-faint" : onTarget ? "text-good" : "text-ink")}>
                  {t.value === null ? "—" : `${t.value}%`}
                </p>
                <p className="text-[11px] text-ink-faint">{t.note ?? (t.target !== undefined ? `Target ${t.lowerIsBetter ? "≤" : "≥"} ${t.target}%` : "Trend")}</p>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}
