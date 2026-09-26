"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterCard, FilterField, filterControl } from "@/components/ui/filter-card";
import { ExportLinks } from "@/components/ui/export-links";
import {
  REPORT_PERIODS,
  reportQuery,
  type ReportFilterFlags,
  type ReportFilterValues,
} from "@/lib/data/report-filters";

/**
 * The filters above a report, and the three things you can do with the result
 * — the shape edos-poa uses for its own reports.
 *
 * Every filter is written to the URL, so a narrowed report is a link: it can be
 * bookmarked, reloaded, or sent to whoever asked for it. The downloads point at
 * the same query against the export route, which re-runs the same query on the
 * server, so a CSV can never be a different set of rows from the table above it.
 */
export function ReportFilters({
  reportKey,
  flags,
  initial,
  stages,
  channels,
  categories,
  statuses,
  canExport,
  note,
}: {
  reportKey: string;
  flags: ReportFilterFlags;
  initial: ReportFilterValues;
  stages: { key: string; label: string }[];
  channels: { value: string; label: string }[];
  categories: string[];
  statuses: { value: string; label: string }[];
  canExport: boolean;
  note?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ReportFilterValues>(k: K, v: ReportFilterValues[K]) =>
    setValues((f) => ({ ...f, [k]: v }));

  const query = () => reportQuery(values, flags);
  const exportBase = `/api/export/report/${reportKey}${query() ? `?${query()}` : ""}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        const q = query();
        router.push(q ? `/reports/${reportKey}?${q}` : `/reports/${reportKey}`);
        // The navigation clears this; a register of several hundred rows takes
        // a moment and the button should say so meanwhile.
        setTimeout(() => setBusy(false), 1200);
      }}
    >
      <FilterCard
        note={note}
        actions={
          <>
            <Button type="submit" busy={busy}>
              Generate
            </Button>
            {canExport && <ExportLinks base={exportBase} />}
            {/* Printing the screen would hand somebody a document that stops at
                whatever the browser fits on a page. This opens the report's own
                PDF — the same query, run again on the server, every row — and
                they print that. */}
            {canExport ? (
              <a
                href={`${exportBase}${query() ? "&" : "?"}format=pdf`}
                target="_blank"
                rel="noopener"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink-faint transition-colors hover:border-brand hover:text-brand"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Print
              </a>
            ) : (
              <button
                type="button"
                onClick={() => window.print()}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink-faint transition-colors hover:border-brand hover:text-brand"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Print this page
              </button>
            )}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flags.dates && (
            <FilterField label="Period" htmlFor="rf-period">
              <select
                id="rf-period"
                value={values.period}
                onChange={(e) => set("period", e.target.value as ReportFilterValues["period"])}
                className={filterControl}
              >
                {REPORT_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </FilterField>
          )}

          {/* The From/To pair only appears once a custom range is chosen, so the
              card isn't carrying two dead date inputs the rest of the time. */}
          {flags.dates && values.period === "custom" && (
            <>
              <FilterField label="From" htmlFor="rf-from">
                <input id="rf-from" type="date" value={values.from} onChange={(e) => set("from", e.target.value)} className={filterControl} />
              </FilterField>
              <FilterField label="To" htmlFor="rf-to">
                <input id="rf-to" type="date" value={values.to} onChange={(e) => set("to", e.target.value)} className={filterControl} />
              </FilterField>
            </>
          )}

          {flags.severity && (
            <FilterField label="Severity" htmlFor="rf-severity">
              <select id="rf-severity" value={values.severity} onChange={(e) => set("severity", e.target.value)} className={filterControl}>
                <option value="all">Any severity</option>
                <option value="T1">T1 — Critical</option>
                <option value="T2">T2 — Major</option>
                <option value="T3">T3 — Minor</option>
              </select>
            </FilterField>
          )}

          {flags.stage && (
            <FilterField label="Stage" htmlFor="rf-stage">
              <select id="rf-stage" value={values.stage} onChange={(e) => set("stage", e.target.value)} className={filterControl}>
                <option value="all">Any stage</option>
                {stages.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FilterField>
          )}

          {flags.channel && (
            <FilterField label="Channel" htmlFor="rf-channel">
              <select id="rf-channel" value={values.channel} onChange={(e) => set("channel", e.target.value)} className={filterControl}>
                <option value="all">Any channel</option>
                {channels.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FilterField>
          )}

          {flags.category && (
            <FilterField label="Category" htmlFor="rf-category">
              <select id="rf-category" value={values.category} onChange={(e) => set("category", e.target.value)} className={filterControl}>
                <option value="all">Any category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FilterField>
          )}

          {flags.status && statuses.length > 0 && (
            <FilterField label="Status" htmlFor="rf-status">
              <select id="rf-status" value={values.status} onChange={(e) => set("status", e.target.value)} className={filterControl}>
                <option value="all">Any status</option>
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FilterField>
          )}

          {flags.search && (
            <FilterField label="Search" htmlFor="rf-q" className="sm:col-span-2 lg:col-span-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                <input
                  id="rf-q"
                  type="search"
                  value={values.q}
                  onChange={(e) => set("q", e.target.value)}
                  placeholder="Case no., complainant, product, SKU or batch"
                  className={`${filterControl} pl-9`}
                />
              </div>
            </FilterField>
          )}
        </div>
      </FilterCard>
    </form>
  );
}
