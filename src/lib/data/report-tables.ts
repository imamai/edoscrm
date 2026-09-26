import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { getComplaints } from "@/lib/data/complaints";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { getAllCompensations } from "@/lib/data/complaint-extras";
import { formatDate } from "@/lib/utils";
import type { Cell, TableExport } from "@/lib/export/table";

/**
 * Reports are tables, not charts — a register you read down a column and
 * download as CSV, Excel or PDF. Charts live on Dashboard and Analytics.
 * Each report builds exactly one table definition, and the same definition
 * feeds both the on-screen table and every download format.
 */

export const REPORT_KEYS = ["complaints", "sla", "quality", "compensation"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_META: Record<ReportKey, { title: string; description: string }> = {
  complaints: { title: "Complaint register", description: "Every complaint on file with its product, batch, channel, severity and stage." },
  sla: { title: "SLA status", description: "Every open complaint against its acknowledgement and RCA deadlines." },
  quality: { title: "Investigation, RCA & CAPA", description: "Findings, root-cause classification and corrective/preventive actions per case." },
  compensation: { title: "Compensation register", description: "Every hamper or credit note requested, its status and the case it belongs to." },
};

export function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}

const today = () => new Date().toISOString().slice(0, 10);

export async function buildReport(key: ReportKey, tenantId: string, tenantName: string): Promise<TableExport> {
  const meta = REPORT_META[key];
  const base = { name: `${key}-${today()}`, title: meta.title, tenantName };

  if (key === "complaints") {
    const [complaints, workflow] = await Promise.all([getComplaints(tenantId), getDefaultWorkflowVersion(tenantId)]);
    const stageLabel = new Map(workflow?.definition.stages.map((s) => [s.key, s.label]) ?? []);
    return {
      ...base,
      subtitle: `${complaints.length} complaints, all time`,
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
    };
  }

  if (key === "sla") {
    const [complaints, slaRules, workflow] = await Promise.all([getComplaints(tenantId), getSlaRules(tenantId), getDefaultWorkflowVersion(tenantId)]);
    const stageLabel = new Map(workflow?.definition.stages.map((s) => [s.key, s.label]) ?? []);
    const open = complaints.filter((c) => c.current_stage_key !== "closed");
    const now = Date.now();
    return {
      ...base,
      subtitle: `${open.length} open complaints`,
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
    };
  }

  if (key === "quality") {
    const complaints = await getComplaints(tenantId);
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
    const withQuality = complaints.filter((c) => invBy.has(c.id) || rcBy.has(c.id) || capaBy.has(c.id));

    return {
      ...base,
      subtitle: `${withQuality.length} complaints with investigation, RCA or CAPA recorded`,
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
    };
  }

  const compensations = await getAllCompensations(tenantId);
  return {
    ...base,
    subtitle: `${compensations.length} compensation requests`,
    header: ["Case no.", "Complaint", "Type", "Amount", "Status", "Requested", "Fulfilled"],
    rows: compensations.map<Cell[]>((c) => [
      c.case_number,
      c.title,
      c.type === "hamper" ? "Replacement hamper" : c.type === "credit_note" ? "Credit note" : "Other",
      c.amount_cents ? c.amount_cents / 100 : "",
      c.status,
      formatDate(c.created_at),
      c.fulfilled_at ? formatDate(c.fulfilled_at) : "",
    ]),
  };
}
