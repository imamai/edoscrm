import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ClipboardList, Clock, FlaskConical, Gift } from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getComplaints } from "@/lib/data/complaints";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { getAllCompensations } from "@/lib/data/complaint-extras";
import { REPORT_META, type ReportKey } from "@/lib/data/report-tables";
import { ExportLinks } from "@/components/ui/export-links";

export const metadata: Metadata = { title: "Reports" };

const ICONS: Record<ReportKey, typeof ClipboardList> = {
  complaints: ClipboardList,
  sla: Clock,
  quality: FlaskConical,
  compensation: Gift,
};
const ORDER: ReportKey[] = ["complaints", "sla", "quality", "compensation"];

/**
 * Gallery index mirroring EDOSPMIS's Reports page. Every report behind it
 * is a table you read and download as CSV, Excel or PDF — charts and trend
 * lines live on Analytics instead.
 */
export default async function ReportsPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const [complaints, slaRules, compensations, canExport] = await Promise.all([
    getComplaints(session.tenant.id),
    getSlaRules(session.tenant.id),
    getAllCompensations(session.tenant.id),
    hasPermission(session.tenant.id, "complaints.export"),
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
          Each report is a table you can read on screen and download as CSV, Excel or PDF. For trend charts, see{" "}
          <Link href="/analytics" className="text-brand hover:underline">
            Analytics
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ORDER.map((key) => {
          const Icon = ICONS[key];
          const meta = REPORT_META[key];
          return (
            <div
              key={key}
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand transition-transform duration-200 group-hover:scale-110">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/reports/${key}`} className="flex items-center gap-1 text-sm font-semibold text-ink hover:text-brand">
                  {meta.title}
                  <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <p className="mt-0.5 text-xs text-ink-faint">{meta.description}</p>
                {canExport && (
                  <div className="mt-2">
                    <ExportLinks base={`/api/export/report/${key}`} />
                  </div>
                )}
              </div>
            </div>
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
