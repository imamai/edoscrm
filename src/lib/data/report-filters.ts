/**
 * What a report can be narrowed by, and how a period is resolved.
 *
 * No "server-only" here: the filter form is a client component and needs the
 * same vocabulary and the same period definitions the server uses, so a
 * preset means exactly one thing on both sides.
 *
 * Every value lives in the URL, which is what makes a narrowed report a link:
 * bookmarkable, reloadable, and sendable to whoever asked for it. The export
 * route parses the identical query string, so a download can never be a
 * different set of rows from the table on screen.
 */

export const REPORT_PERIODS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "mtd", label: "This month" },
  { value: "qtd", label: "This quarter" },
  { value: "ytd", label: "This year" },
  { value: "custom", label: "Custom range…" },
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number]["value"];

export function isReportPeriod(value: string | null | undefined): value is ReportPeriod {
  return REPORT_PERIODS.some((p) => p.value === value);
}

/** Which controls a given report shows — a report about right now has no period. */
export interface ReportFilterFlags {
  dates: boolean;
  severity?: boolean;
  stage?: boolean;
  channel?: boolean;
  category?: boolean;
  /** The report's own status column: CAPA status, or compensation status. */
  status?: boolean;
  /** Filter by the person the case is assigned to — the brief names owner as
   * both a reporting dimension and a search field. */
  owner?: boolean;
  search?: boolean;
}

export interface ReportFilterValues {
  period: ReportPeriod;
  from: string;
  to: string;
  severity: string;
  stage: string;
  channel: string;
  category: string;
  status: string;
  owner: string;
  q: string;
}

export const EMPTY_FILTERS: ReportFilterValues = {
  period: "all",
  from: "",
  to: "",
  severity: "all",
  stage: "all",
  channel: "all",
  category: "all",
  status: "all",
  owner: "all",
  q: "",
};

/** Read filter values out of a URL's query string. */
export function parseReportFilters(searchParams: Record<string, string | string[] | undefined>): ReportFilterValues {
  const one = (key: string) => {
    const v = searchParams[key];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const period = one("period");
  return {
    period: isReportPeriod(period) ? period : "all",
    from: one("from"),
    to: one("to"),
    severity: one("severity") || "all",
    stage: one("stage") || "all",
    channel: one("channel") || "all",
    category: one("category") || "all",
    status: one("status") || "all",
    owner: one("owner") || "all",
    q: one("q"),
  };
}

/** Turn filter values back into a query string — the one place the shape of a
 * report link is decided, so the page, the export links and the print link
 * can't drift apart. */
export function reportQuery(values: ReportFilterValues, flags: ReportFilterFlags): string {
  const p = new URLSearchParams();
  if (flags.dates) {
    if (values.period !== "all") p.set("period", values.period);
    if (values.period === "custom") {
      if (values.from) p.set("from", values.from);
      if (values.to) p.set("to", values.to);
    }
  }
  if (flags.severity && values.severity !== "all") p.set("severity", values.severity);
  if (flags.stage && values.stage !== "all") p.set("stage", values.stage);
  if (flags.channel && values.channel !== "all") p.set("channel", values.channel);
  if (flags.category && values.category !== "all") p.set("category", values.category);
  if (flags.status && values.status !== "all") p.set("status", values.status);
  if (flags.owner && values.owner !== "all") p.set("owner", values.owner);
  if (flags.search && values.q.trim()) p.set("q", values.q.trim());
  return p.toString();
}

export interface ResolvedPeriod {
  /** Inclusive ISO instants, or undefined for an open end. */
  from?: string;
  to?: string;
  /** How the period reads on the report and in the PDF header. */
  label: string;
}

/**
 * Resolve a preset (or a custom pair) into real instants.
 *
 * `to` is pushed to the end of its day so a range typed as two dates includes
 * everything logged on the closing date — the thing people mean by "to the
 * 30th" and the classic off-by-one-day in a date-range report.
 */
export function resolvePeriod(values: ReportFilterValues, now = new Date()): ResolvedPeriod {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const iso = (d: Date) => d.toISOString();
  const endOf = (ymd: string) => `${ymd}T23:59:59.999Z`;

  switch (values.period) {
    case "7d": {
      const from = startOfDay(new Date(now.getTime() - 6 * 86_400_000));
      return { from: iso(from), label: "Last 7 days" };
    }
    case "30d": {
      const from = startOfDay(new Date(now.getTime() - 29 * 86_400_000));
      return { from: iso(from), label: "Last 30 days" };
    }
    case "mtd":
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), label: "This month" };
    case "qtd":
      return { from: iso(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), label: "This quarter" };
    case "ytd":
      return { from: iso(new Date(now.getFullYear(), 0, 1)), label: "This year" };
    case "custom": {
      const from = values.from ? `${values.from}T00:00:00.000Z` : undefined;
      const to = values.to ? endOf(values.to) : undefined;
      const label =
        from && to ? `${values.from} to ${values.to}` : from ? `From ${values.from}` : to ? `Up to ${values.to}` : "All time";
      return { from, to, label };
    }
    default:
      return { label: "All time" };
  }
}

/** The human description of everything narrowing a report — printed under the
 * title on screen and in the PDF, so an exported file says what it covers. */
export function describeFilters(values: ReportFilterValues, flags: ReportFilterFlags, period: ResolvedPeriod): string {
  const parts: string[] = [];
  if (flags.dates) parts.push(period.label);
  if (flags.severity && values.severity !== "all") parts.push(`severity ${values.severity}`);
  if (flags.stage && values.stage !== "all") parts.push(`stage ${values.stage}`);
  if (flags.channel && values.channel !== "all") parts.push(`channel ${values.channel}`);
  if (flags.category && values.category !== "all") parts.push(values.category);
  if (flags.status && values.status !== "all") parts.push(`status ${values.status}`);
  if (flags.owner && values.owner !== "all") parts.push(values.owner === "unassigned" ? "unassigned" : "one owner");
  if (flags.search && values.q.trim()) parts.push(`matching "${values.q.trim()}"`);
  return parts.join(" · ");
}
