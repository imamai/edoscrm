import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { buildReport, isReportKey, REPORT_META, REPORT_STATUS_OPTIONS } from "@/lib/data/report-tables";
import { parseReportFilters } from "@/lib/data/report-filters";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { COMPLAINT_CATEGORIES } from "@/lib/domain/categories";
import { BackLink } from "@/components/ui/back-link";
import { RecordCount } from "@/components/ui/filter-card";
import { ReportFilters } from "./report-filters";

export async function generateMetadata({ params }: { params: Promise<{ report: string }> }): Promise<Metadata> {
  const { report } = await params;
  return { title: isReportKey(report) ? REPORT_META[report].title : "Report" };
}

const CHANNELS = [
  { value: "internal", label: "Internal" },
  { value: "web", label: "Website" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "walk_in", label: "Walk-in" },
];

/**
 * A report is a table you narrow, read and download — the same rows, in the
 * same order, whether you're looking at the screen or opening the CSV. Charts
 * and trend lines live on Dashboard and Analytics instead.
 */
export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { report } = await params;
  if (!isReportKey(report)) notFound();

  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const filters = parseReportFilters(await searchParams);
  const meta = REPORT_META[report];

  const [result, canExport, workflow] = await Promise.all([
    buildReport(report, session.tenant.id, session.tenant.name, filters),
    hasPermission(session.tenant.id, "complaints.export"),
    meta.filters.stage ? getDefaultWorkflowVersion(session.tenant.id) : Promise.resolve(null),
  ]);
  const { table, total } = result;

  // Columns whose every value is a number get right-aligned and tabular,
  // the same rule the PDF/Excel writers apply to the same table.
  const numeric = table.header.map(
    (_, c) => table.rows.length > 0 && table.rows.every((r) => r[c] === "" || r[c] == null || typeof r[c] === "number"),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackLink href="/reports" label="Reports" />
        <h1 className="text-xl font-semibold text-ink">{meta.title}</h1>
        <p className="text-sm text-ink-faint">{table.subtitle}</p>
      </div>

      <ReportFilters
        reportKey={report}
        flags={meta.filters}
        initial={filters}
        stages={workflow?.definition.stages.map((s) => ({ key: s.key, label: s.label })) ?? []}
        channels={CHANNELS}
        categories={COMPLAINT_CATEGORIES}
        statuses={REPORT_STATUS_OPTIONS[report] ?? []}
        canExport={canExport}
        note={meta.description}
      />

      <div>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {table.rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-faint">
              Nothing matches these filters. Widen the period or clear a filter above.
            </p>
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
        <RecordCount shown={table.rows.length} total={total} />
      </div>
    </div>
  );
}
