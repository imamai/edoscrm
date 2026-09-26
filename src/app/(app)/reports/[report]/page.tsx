import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { buildReport, isReportKey, REPORT_META } from "@/lib/data/report-tables";
import { ExportLinks } from "@/components/ui/export-links";

export async function generateMetadata({ params }: { params: Promise<{ report: string }> }): Promise<Metadata> {
  const { report } = await params;
  return { title: isReportKey(report) ? REPORT_META[report].title : "Report" };
}

/**
 * A report is a table you read and download — the same rows, in the same
 * order, whether you're looking at the screen or opening the CSV. Charts
 * and trend lines live on Dashboard and Analytics instead.
 */
export default async function ReportDetailPage({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!isReportKey(report)) notFound();

  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const [table, canExport] = await Promise.all([
    buildReport(report, session.tenant.id, session.tenant.name),
    hasPermission(session.tenant.id, "complaints.export"),
  ]);
  const meta = REPORT_META[report];

  // Columns whose every value is a number get right-aligned and tabular,
  // the same rule the PDF/Excel writers apply to the same table.
  const numeric = table.header.map((_, c) => table.rows.length > 0 && table.rows.every((r) => r[c] === "" || r[c] == null || typeof r[c] === "number"));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/reports" className="flex w-fit items-center gap-1 text-sm font-semibold text-ink-faint hover:text-brand">
            <ArrowLeft className="h-3.5 w-3.5" />
            Reports
          </Link>
          <h1 className="text-xl font-semibold text-ink">{meta.title}</h1>
          <p className="text-sm text-ink-faint">{table.subtitle}</p>
        </div>
        {canExport && <ExportLinks base={`/api/export/report/${report}`} />}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {table.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-faint">Nothing to report yet.</p>
        ) : (
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  {table.header.map((h, i) => (
                    <th key={h} className={`px-3 py-2.5 whitespace-nowrap ${numeric[i] ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-border last:border-0 odd:bg-background/40">
                    {row.map((cell, ci) => (
                      <td key={ci} className={`max-w-[22rem] truncate px-3 py-2 text-ink ${numeric[ci] ? "tnum text-right" : ""}`} title={String(cell ?? "")}>
                        {cell === null || cell === undefined || cell === "" ? <span className="text-ink-faint">—</span> : typeof cell === "number" ? cell.toLocaleString() : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
