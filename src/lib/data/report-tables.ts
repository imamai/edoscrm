import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { getComplaints, type Channel, type Complaint, type Severity } from "@/lib/data/complaints";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { getAllCompensations } from "@/lib/data/complaint-extras";
import { formatDate } from "@/lib/utils";
import {
  describeFilters,
  resolvePeriod,
  EMPTY_FILTERS,
  type ReportFilterFlags,
  type ReportFilterValues,
} from "@/lib/data/report-filters";
import type { Cell, TableExport } from "@/lib/export/table";

/**
 * Reports are tables, not charts — a register you read down a column and
 * download as CSV, Excel or PDF. Charts live on Dashboard and Analytics.
 * Each report builds exactly one table definition from one set of filters, and
 * that definition feeds both the on-screen table and every download format, so
 * a downloaded file is always the rows that were on screen.
 */

export const REPORT_KEYS = ["complaints", "sla", "quality", "compensation"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_META: Record<ReportKey, { title: string; description: string; filters: ReportFilterFlags }> = {
  complaints: {
    title: "Complaint register",
    description: "Every complaint on file with its product, batch, channel, severity and stage.",
    filters: { dates: true, severity: true, stage: true, channel: true, category: true, search: true },
  },
  sla: {
    title: "SLA status",
    description: "Every open complaint against its acknowledgement and RCA deadlines.",
    // No stage filter: this report is already scoped to what is still open,
    // and no channel/category — an SLA breach is a breach whatever the route in.
    filters: { dates: true, severity: true, search: true },
  },
  quality: {
    title: "Investigation, RCA & CAPA",
    description: "Findings, root-cause classification and corrective/preventive actions per case.",
    // `status` here is CAPA status, the thing anyone reading this report chases.
    filters: { dates: true, severity: true, status: true, category: true, search: true },
  },
  compensation: {
    title: "Compensation register",
    description: "Every hamper or credit note requested, its status and the case it belongs to.",
    // `status` here is the compensation's own request status.
    filters: { dates: true, status: true, search: true },
  },
};

/** The statuses the `status` control offers, per report. */
export const REPORT_STATUS_OPTIONS: Partial<Record<ReportKey, { value: string; label: string }[]>> = {
  quality: [
    { value: "open", label: "CAPA open" },
    { value: "in_progress", label: "CAPA in progress" },
    { value: "verified", label: "CAPA verified" },
    { value: "closed", label: "CAPA closed" },
    { value: "none", label: "No CAPA recorded" },
  ],
  compensation: [
    { value: "requested", label: "Requested" },
    { value: "approved", label: "Approved" },
    { value: "fulfilled", label: "Fulfilled" },
    { value: "declined", label: "Declined" },
  ],
};

export function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}

const today = () => new Date().toISOString().slice(0, 10);

export interface ReportResult {
  table: TableExport;
  /** Rows before filtering, so the page can say "12 of 40". */
  total: number;
}

/** Turn filter values into the shape `getComplaints` takes. */
function complaintQuery(values: ReportFilterValues, flags: ReportFilterFlags) {
  const period = resolvePeriod(values);
  return {
    from: flags.dates ? period.from : undefined,
    to: flags.dates ? period.to : undefined,
    severity: flags.severity && values.severity !== "all" ? (values.severity as Severity) : undefined,
    status: flags.stage && values.stage !== "all" ? values.stage : undefined,
    channel: flags.channel && values.channel !== "all" ? (values.channel as Channel) : undefined,
    category: flags.category && values.category !== "all" ? values.category : undefined,
    q: flags.search ? values.q : undefined,
  };
}

export async function buildReport(
  key: ReportKey,
  tenantId: string,
  tenantName: string,
  values: ReportFilterValues = EMPTY_FILTERS,
): Promise<ReportResult> {
  const meta = REPORT_META[key];
  const flags = meta.filters;
  const period = resolvePeriod(values);
  const described = describeFilters(values, flags, period);
  // The file name carries the period, so two downloads of the same report over
  // different months don't overwrite each other in the Downloads folder.
  const name = `${key}-${values.period === "all" ? "all-time" : values.period}-${today()}`;
  const base = { name, title: meta.title, tenantName };

  if (key === "complaints") {
    const [complaints, workflow, allCount] = await Promise.all([
      getComplaints(tenantId, complaintQuery(values, flags)),
      getDefaultWorkflowVersion(tenantId),
      countAll(tenantId),
    ]);
    const stageLabel = new Map(workflow?.definition.stages.map((s) => [s.key, s.label]) ?? []);
    return {
      total: allCount,
      table: {
        ...base,
        subtitle: `${complaints.length} complaints — ${described || "all time"}`,
        header: ["Case no.", "Title", "Category", "Severity", "Stage", "Channel", "Product", "SKU", "Batch", "Complainant", "Opened", "Closed"],
        rows: complaints.map<Cell[]>((c) => [
          c.case_number,
          c.title,
          c.category ?? "",
          c.severity,
          stageLabel.get(c.current_stage_key) ?? c.current_stage_key,
          c.source,
          c.product_name ?? "",
          c.sku ?? "",
          c.batch_number ?? "",
          c.reporter_name ?? "",
          formatDate(c.created_at),
          c.closed_at ? formatDate(c.closed_at) : "",
        ]),
      },
    };
  }

  if (key === "sla") {
    const [complaints, slaRules, workflow, allCount] = await Promise.all([
      getComplaints(tenantId, complaintQuery(values, flags)),
      getSlaRules(tenantId),
      getDefaultWorkflowVersion(tenantId),
      countAll(tenantId),
    ]);
    const stageLabel = new Map(workflow?.definition.stages.map((s) => [s.key, s.label]) ?? []);
    const open = complaints.filter((c) => c.current_stage_key !== "closed");
    const now = Date.now();
    return {
      total: allCount,
      table: {
        ...base,
        subtitle: `${open.length} open complaints — ${described || "all time"}`,
        header: ["Case no.", "Title", "Severity", "Stage", "SLA status", "Days open", "Opened"],
        rows: open.map<Cell[]>((c) => {
          const rule = slaRules[c.severity];
          const status = rule
            ? computeSlaStatus({ createdAt: c.created_at, currentStageKey: c.current_stage_key, acknowledgementMinutes: rule.acknowledgement_minutes, rcaMinutes: rule.rca_minutes })
            : null;
          return [
            c.case_number,
            c.title,
            c.severity,
            stageLabel.get(c.current_stage_key) ?? c.current_stage_key,
            status?.label ?? "No SLA rule",
            Math.round((now - new Date(c.created_at).getTime()) / 86_400_000),
            formatDate(c.created_at),
          ];
        }),
      },
    };
  }

  if (key === "quality") {
    const [complaints, allCount] = await Promise.all([getComplaints(tenantId, complaintQuery(values, flags)), countAll(tenantId)]);
    const ids = complaints.map((c) => c.id);
    const supabase = await createClient();
    const [{ data: investigations }, { data: rootCauses }, { data: capas }] = await Promise.all([
      supabase.from(TABLES.investigations).select("complaint_id, findings").in("complaint_id", ids.length ? ids : ["none"]),
      supabase.from(TABLES.rootCauses).select("complaint_id, category, description").in("complaint_id", ids.length ? ids : ["none"]),
      supabase.from(TABLES.capas).select("complaint_id, corrective_action, preventive_action, status, due_date, verified_at").in("complaint_id", ids.length ? ids : ["none"]),
    ]);
    const invBy = new Map((investigations ?? []).map((r) => [r.complaint_id as string, r]));
    const rcBy = new Map((rootCauses ?? []).map((r) => [r.complaint_id as string, r]));
    const capaBy = new Map((capas ?? []).map((r) => [r.complaint_id as string, r]));

    let withQuality = complaints.filter((c) => invBy.has(c.id) || rcBy.has(c.id) || capaBy.has(c.id));
    if (values.status !== "all") {
      withQuality =
        values.status === "none"
          ? withQuality.filter((c) => !capaBy.has(c.id))
          : withQuality.filter((c) => (capaBy.get(c.id)?.status as string) === values.status);
    }

    return {
      total: allCount,
      table: {
        ...base,
        subtitle: `${withQuality.length} complaints with investigation, RCA or CAPA recorded — ${described || "all time"}`,
        header: ["Case no.", "Title", "Severity", "Findings", "Root cause", "Root cause detail", "Corrective action", "Preventive action", "CAPA status", "CAPA due", "Verified"],
        rows: withQuality.map<Cell[]>((c) => {
          const inv = invBy.get(c.id);
          const rc = rcBy.get(c.id);
          const capa = capaBy.get(c.id);
          return [
            c.case_number,
            c.title,
            c.severity,
            (inv?.findings as string) ?? "",
            (rc?.category as string) ?? "",
            (rc?.description as string) ?? "",
            (capa?.corrective_action as string) ?? "",
            (capa?.preventive_action as string) ?? "",
            (capa?.status as string) ?? "",
            capa?.due_date ? formatDate(capa.due_date as string) : "",
            capa?.verified_at ? formatDate(capa.verified_at as string) : "",
          ];
        }),
      },
    };
  }

  // Compensation: filtered on the compensation's own request date and status,
  // not the complaint's — a credit note raised this month against a case from
  // last quarter belongs in this month's register.
  const all = await getAllCompensations(tenantId);
  const p = resolvePeriod(values);
  const term = values.q.trim().toLowerCase();
  const rows = all.filter((c) => {
    if (p.from && c.created_at < p.from) return false;
    if (p.to && c.created_at > p.to) return false;
    if (values.status !== "all" && c.status !== values.status) return false;
    if (term && !`${c.case_number} ${c.title}`.toLowerCase().includes(term)) return false;
    return true;
  });

  return {
    total: all.length,
    table: {
      ...base,
      subtitle: `${rows.length} compensation requests — ${described || "all time"}`,
      header: ["Case no.", "Complaint", "Type", "Amount", "Status", "Requested", "Fulfilled"],
      rows: rows.map<Cell[]>((c) => [
        c.case_number,
        c.title,
        c.type === "hamper" ? "Replacement hamper" : c.type === "credit_note" ? "Credit note" : "Other",
        c.amount_cents ? c.amount_cents / 100 : "",
        c.status,
        formatDate(c.created_at),
        c.fulfilled_at ? formatDate(c.fulfilled_at) : "",
      ]),
    },
  };
}

/** Unfiltered complaint count, for "showing 12 of 40". */
async function countAll(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from(TABLES.complaints).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  return count ?? 0;
}

export type { Complaint };
