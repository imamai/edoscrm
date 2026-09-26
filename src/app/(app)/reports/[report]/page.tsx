import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { getComplaints, type Channel } from "@/lib/data/complaints";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { computeKpis } from "@/lib/data/kpis";
import { getAllCompensations } from "@/lib/data/complaint-extras";
import { hasPermission } from "@/lib/auth/permissions";
import { ChannelBadge } from "@/components/complaints/channel-badge";
import { BarChart, DonutChart, CHART, wholeNumber } from "@/components/charts/charts";
import { formatDate } from "@/lib/utils";

const TITLES: Record<string, string> = {
  pipeline: "Pipeline & severity",
  channels: "Channels",
  kpis: "Quality KPIs",
  compensation: "Compensation",
};

export async function generateMetadata({ params }: { params: Promise<{ report: string }> }): Promise<Metadata> {
  const { report } = await params;
  return { title: TITLES[report] ?? "Report" };
}

const STATUS_LABEL: Record<string, string> = { requested: "Requested", approved: "Approved", fulfilled: "Fulfilled", declined: "Declined" };

export default async function ReportDetailPage({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!TITLES[report]) notFound();

  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href="/reports" className="flex w-fit items-center gap-1 text-sm font-semibold text-ink-faint hover:text-brand">
          <ArrowLeft className="h-3.5 w-3.5" />
          Reports
        </Link>
        <h1 className="text-xl font-semibold text-ink">{TITLES[report]}</h1>
      </div>

      {report === "pipeline" && <PipelineReport tenantId={session.tenant.id} />}
      {report === "channels" && <ChannelsReport tenantId={session.tenant.id} />}
      {report === "kpis" && <KpisReport tenantId={session.tenant.id} />}
      {report === "compensation" && <CompensationReport tenantId={session.tenant.id} canApprove={await hasPermission(session.tenant.id, "complaints.compensation.approve")} />}
    </div>
  );
}

async function PipelineReport({ tenantId }: { tenantId: string }) {
  const [complaints, workflow] = await Promise.all([getComplaints(tenantId), getDefaultWorkflowVersion(tenantId)]);
  const stages = workflow?.definition.stages ?? [];
  const byStage = new Map<string, number>();
  for (const c of complaints) byStage.set(c.current_stage_key, (byStage.get(c.current_stage_key) ?? 0) + 1);
  const stageBars = stages.map((s) => ({ label: s.label, value: byStage.get(s.key) ?? 0 }));

  const bySeverity = { T1: 0, T2: 0, T3: 0 };
  for (const c of complaints) bySeverity[c.severity]++;
  const severitySlices = [
    { label: "T1 — Critical", value: bySeverity.T1, color: CHART.danger },
    { label: "T2 — Major", value: bySeverity.T2, color: CHART.secondary },
    { label: "T3 — Minor", value: bySeverity.T3, color: CHART.primary },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">By stage — all time</h2>
        {stageBars.some((b) => b.value > 0) ? <BarChart bars={stageBars} format={wholeNumber} label="By stage" /> : <p className="text-sm text-ink-faint">No complaints logged yet.</p>}
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">By severity — all time</h2>
        {complaints.length > 0 ? (
          <DonutChart slices={severitySlices} centre={String(complaints.length)} format={wholeNumber} label="By severity" />
        ) : (
          <p className="text-sm text-ink-faint">No complaints logged yet.</p>
        )}
      </div>
    </div>
  );
}

async function ChannelsReport({ tenantId }: { tenantId: string }) {
  const complaints = await getComplaints(tenantId);
  const byChannel = new Map<Channel, number>();
  for (const c of complaints) byChannel.set(c.source, (byChannel.get(c.source) ?? 0) + 1);
  const channelOrder: Channel[] = ["web", "phone", "email", "whatsapp", "walk_in", "internal"];
  const rows = channelOrder.filter((ch) => (byChannel.get(ch) ?? 0) > 0).map((ch) => ({ channel: ch, count: byChannel.get(ch) ?? 0 }));
  const bars = rows.map((r, i) => ({ label: r.channel, value: r.count, color: CHART.series[i % CHART.series.length] }));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">By channel — all time</h2>
        {bars.length > 0 ? <BarChart bars={bars} format={wholeNumber} label="By channel" /> : <p className="text-sm text-ink-faint">No complaints logged yet.</p>}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-2">Channel</th>
              <th className="px-4 py-2 text-right">Count</th>
              <th className="px-4 py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.channel} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <ChannelBadge channel={r.channel} />
                </td>
                <td className="tnum px-4 py-2 text-right text-ink">{r.count}</td>
                <td className="tnum px-4 py-2 text-right text-ink-faint">{complaints.length ? Math.round((r.count / complaints.length) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function KpisReport({ tenantId }: { tenantId: string }) {
  const kpis = await computeKpis(tenantId);
  const tiles: { label: string; value: number | null; target?: number; note?: string; lowerIsBetter?: boolean }[] = [
    { label: "Capture rate", value: kpis.captureRate, note: "Not measurable from inside this system alone" },
    { label: "Acknowledgement SLA", value: kpis.acknowledgementSlaPct, target: 100 },
    { label: "Closed-loop rate", value: kpis.closedLoopPct, target: 85 },
    { label: "RCA SLA (T1/T2)", value: kpis.rcaSlaPct, target: 100 },
    { label: "CAPA on-time", value: kpis.capaOnTimePct, target: 100 },
    { label: "Repeat issue rate", value: kpis.repeatIssuePct, lowerIsBetter: true },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-4 text-xs text-ink-faint">
        Brief §7&rsquo;s KPI table. Acknowledgement SLA reads current live status rather than a separately-recorded
        acknowledgement timestamp — the closest proxy available from what this system actually records.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => {
          const onTarget = t.value !== null && t.target !== undefined && (t.lowerIsBetter ? t.value <= t.target : t.value >= t.target);
          return (
            <div key={t.label} className="flex flex-col gap-1 rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-ink-faint">{t.label}</p>
              <p className={`text-xl font-semibold tabular-nums ${t.value === null ? "text-ink-faint" : onTarget ? "text-good" : "text-ink"}`}>
                {t.value === null ? "—" : `${t.value}%`}
              </p>
              <p className="text-[11px] text-ink-faint">{t.note ?? (t.target !== undefined ? `Target ${t.lowerIsBetter ? "≤" : "≥"} ${t.target}%` : "Trend")}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function CompensationReport({ tenantId, canApprove }: { tenantId: string; canApprove: boolean }) {
  const compensations = await getAllCompensations(tenantId);
  void canApprove; // reserved: inline decide-actions could live here later, mirroring the per-case panel

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {compensations.length === 0 ? (
        <p className="p-8 text-center text-sm text-ink-faint">No compensation has been requested yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-2">Case</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Requested</th>
            </tr>
          </thead>
          <tbody>
            {compensations.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/complaints/${c.complaint_id}`} className="font-medium text-brand hover:underline">
                    {c.case_number}
                  </Link>
                  <span className="ml-2 text-ink-faint">{c.title}</span>
                </td>
                <td className="px-4 py-2 text-ink">{c.type === "hamper" ? "Replacement hamper" : c.type === "credit_note" ? "Credit note" : "Other"}</td>
                <td className="tnum px-4 py-2 text-right text-ink-soft">{c.amount_cents ? `KES ${(c.amount_cents / 100).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-2 text-ink-faint">{STATUS_LABEL[c.status]}</td>
                <td className="px-4 py-2 text-ink-faint">{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
