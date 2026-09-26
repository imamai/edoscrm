import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Gauge, Layers, Radio, Gift } from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { getComplaints } from "@/lib/data/complaints";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { getAllCompensations } from "@/lib/data/complaint-extras";

export const metadata: Metadata = { title: "Reports" };

const REPORTS = [
  { key: "pipeline", title: "Pipeline & severity", description: "Every complaint by stage and by T1/T2/T3 severity.", icon: Layers },
  { key: "channels", title: "Channels", description: "Where complaints actually come from — internal, web, phone, email, WhatsApp, walk-in.", icon: Radio },
  { key: "kpis", title: "Quality KPIs", description: "The brief's §7 KPI table: acknowledgement SLA, closed-loop rate, RCA SLA, CAPA on-time, repeat issues.", icon: Gauge },
  { key: "compensation", title: "Compensation", description: "Every hamper or credit note requested, its status, and the case it's traceable to.", icon: Gift },
] as const;

/**
 * Gallery index mirroring EDOSPMIS's own Reports page (a card per report,
 * opened to read the detail — not one page trying to be every report at
 * once) and edos-poa's "at a glance" strip underneath. Trend charts over
 * time live on Analytics instead — this page is for reading a specific,
 * complete answer, not for watching a line move.
 */
export default async function ReportsPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const [complaints, slaRules, compensations] = await Promise.all([
    getComplaints(session.tenant.id),
    getSlaRules(session.tenant.id),
    getAllCompensations(session.tenant.id),
  ]);

  const open = complaints.filter((c) => c.current_stage_key !== "closed");
  let breached = 0;
  for (const c of open) {
    const rule = slaRules[c.severity];
    if (!rule) continue;
    const status = computeSlaStatus({ createdAt: c.created_at, currentStageKey: c.current_stage_key, acknowledgementMinutes: rule.acknowledgement_minutes, rcaMinutes: rule.rca_minutes });
    if (status.level === "danger") breached++;
  }
  const pendingCompensation = compensations.filter((c) => c.status === "requested").length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Reports</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Open a report to read it in full. Looking for trend charts instead? Try{" "}
          <Link href="/analytics" className="text-brand hover:underline">
            Analytics
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.key}
              href={`/reports/${r.key}`}
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand transition-transform duration-200 group-hover:scale-110">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{r.title}</p>
                <p className="mt-0.5 text-xs text-ink-faint">{r.description}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand" />
            </Link>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm font-semibold text-ink">All time at a glance</p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Glance label="Total complaints" value={String(complaints.length)} />
          <Glance label="Open" value={String(open.length)} />
          <Glance label="SLA breached" value={String(breached)} />
          <Glance label="Compensation pending" value={String(pendingCompensation)} />
        </div>
      </div>
    </div>
  );
}

function Glance({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="tnum mt-0.5 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}
