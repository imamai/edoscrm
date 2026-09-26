import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getComplaints, getBatchSiblings, type Channel } from "@/lib/data/complaints";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { computeKpis } from "@/lib/data/kpis";
import { getQualityRecords } from "@/lib/data/investigation";
import { getCommunications, getCompensations } from "@/lib/data/complaint-extras";
import { formatDate } from "@/lib/utils";
import { TABLES } from "@/lib/data/tables";

/**
 * Read-only data-query tools for edos.ai's chat assistant (ported pattern
 * from EDOSPMIS's lib/ai/tools.ts, the only "answer questions about the
 * tenant's own data" engine found across the sibling codebases — edos-poa's
 * /assistant and edoshatch360 apparently run the same shape of thing). The
 * model never touches the database directly: every fact it can state comes
 * back from one of these, already scoped to the caller's tenant.
 */

export interface ToolContext {
  tenantId: string;
}

export function createToolContext(tenantId: string): ToolContext {
  return { tenantId };
}

export interface Tool {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  label: (input: Record<string, unknown>) => string;
  run: (ctx: ToolContext, input: Record<string, unknown>) => Promise<unknown>;
}

export const TOOLS: Tool[] = [
  {
    name: "open_complaints_summary",
    description:
      "Every open complaint (not yet Closed), with severity, stage, channel and how many days it's been open. Use for backlog, aging, overdue, or 'what's outstanding' questions.",
    input_schema: { type: "object", properties: {} },
    label: () => "Open complaints",
    run: async (ctx) => {
      const all = await getComplaints(ctx.tenantId);
      const open = all.filter((c) => c.current_stage_key !== "closed");
      const now = Date.now();
      return {
        count: open.length,
        complaints: open
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(0, 40)
          .map((c) => ({
            case_number: c.case_number,
            title: c.title,
            severity: c.severity,
            stage: c.current_stage_key,
            channel: c.source,
            pending_information: c.pending_information,
            days_open: Math.round((now - new Date(c.created_at).getTime()) / 86_400_000),
          })),
      };
    },
  },
  {
    name: "sla_status",
    description: "Every complaint currently at risk of or already breaching its SLA (acknowledgement or RCA deadline), by severity. Use for SLA, overdue, or breach questions.",
    input_schema: { type: "object", properties: {} },
    label: () => "SLA status",
    run: async (ctx) => {
      const [all, slaRules] = await Promise.all([getComplaints(ctx.tenantId), getSlaRules(ctx.tenantId)]);
      const open = all.filter((c) => c.current_stage_key !== "closed");
      const flagged = [];
      for (const c of open) {
        const rule = slaRules[c.severity];
        if (!rule) continue;
        const status = computeSlaStatus({ createdAt: c.created_at, currentStageKey: c.current_stage_key, acknowledgementMinutes: rule.acknowledgement_minutes, rcaMinutes: rule.rca_minutes });
        if (status.level !== "good") flagged.push({ case_number: c.case_number, title: c.title, severity: c.severity, status: status.label });
      }
      return { count: flagged.length, complaints: flagged };
    },
  },
  {
    name: "breakdown_by",
    description: "Count of all complaints grouped by one dimension: 'stage', 'severity', or 'channel'. Use for 'how many', 'which channel', 'by severity' type questions.",
    input_schema: { type: "object", properties: { dimension: { type: "string", enum: ["stage", "severity", "channel"] } }, required: ["dimension"] },
    label: (i) => `Breakdown by ${i.dimension}`,
    run: async (ctx, input) => {
      const dimension = String(input.dimension ?? "stage");
      const all = await getComplaints(ctx.tenantId);
      const counts = new Map<string, number>();
      if (dimension === "severity") for (const c of all) counts.set(c.severity, (counts.get(c.severity) ?? 0) + 1);
      else if (dimension === "channel") for (const c of all) counts.set(c.source, (counts.get(c.source) ?? 0) + 1);
      else {
        const workflow = await getDefaultWorkflowVersion(ctx.tenantId);
        const stageLabel = new Map(workflow?.definition.stages.map((s) => [s.key, s.label]) ?? []);
        for (const c of all) {
          const label = stageLabel.get(c.current_stage_key) ?? c.current_stage_key;
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
      }
      return { total: all.length, by: dimension, counts: Object.fromEntries(counts) };
    },
  },
  {
    name: "find_complaint",
    description: "Search for a complaint by its case number (e.g. CASE-2026-000012), title, or complainant name.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    label: (i) => `Find complaint: "${i.query}"`,
    run: async (ctx, input) => {
      const q = String(input.query ?? "").trim().toLowerCase();
      if (!q) return { error: "Give a case number, title, or complainant name." };
      const all = await getComplaints(ctx.tenantId);
      const matches = all.filter(
        (c) => c.case_number.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || (c.reporter_name ?? "").toLowerCase().includes(q),
      );
      if (matches.length === 0) return { error: "No complaint matches that." };
      return matches.slice(0, 10).map((c) => ({ case_number: c.case_number, title: c.title, severity: c.severity, stage: c.current_stage_key, complainant: c.reporter_name }));
    },
  },
  {
    name: "complaint_details",
    description: "The full picture of one complaint by its case number: description, product/batch, investigation, root cause, CAPA, communications logged, and any compensation.",
    input_schema: { type: "object", properties: { case_number: { type: "string" } }, required: ["case_number"] },
    label: (i) => `Complaint ${i.case_number}`,
    run: async (ctx, input) => {
      const caseNumber = String(input.case_number ?? "").trim();
      const supabase = await createClient();
      const { data: c } = await supabase.from(TABLES.complaints).select("*").eq("tenant_id", ctx.tenantId).eq("case_number", caseNumber).maybeSingle();
      if (!c) return { error: "No complaint with that case number." };

      const [quality, communications, compensations] = await Promise.all([getQualityRecords(c.id), getCommunications(c.id), getCompensations(c.id)]);

      return {
        case_number: c.case_number,
        title: c.title,
        description: c.description,
        severity: c.severity,
        stage: c.current_stage_key,
        channel: c.source,
        pending_information: c.pending_information ? c.pending_information_reason ?? true : false,
        complainant: c.reporter_name,
        product: c.product_name,
        sku: c.sku,
        batch_number: c.batch_number,
        opened: formatDate(c.created_at),
        closed: c.closed_at ? formatDate(c.closed_at) : null,
        closure_note: c.closure_note,
        investigation: quality.investigation?.findings ?? null,
        root_cause: quality.rootCause && { category: quality.rootCause.category, description: quality.rootCause.description },
        capa: quality.capa && { corrective: quality.capa.corrective_action, preventive: quality.capa.preventive_action, status: quality.capa.status, due: quality.capa.due_date },
        communications: communications.slice(0, 10).map((m) => ({ direction: m.direction, channel: m.channel, message: m.message, when: formatDate(m.created_at) })),
        compensation: compensations.map((comp) => ({ type: comp.type, status: comp.status, amount_cents: comp.amount_cents })),
      };
    },
  },
  {
    name: "batch_pattern",
    description: "Every complaint sharing a given SKU and batch number — use for 'is this batch showing a pattern' or 'which other complaints share this batch' questions.",
    input_schema: { type: "object", properties: { sku: { type: "string" }, batch_number: { type: "string" } }, required: ["sku", "batch_number"] },
    label: (i) => `Batch ${i.sku}/${i.batch_number}`,
    run: async (ctx, input) => {
      const sku = String(input.sku ?? "").trim();
      const batch = String(input.batch_number ?? "").trim();
      if (!sku || !batch) return { error: "Give both a SKU and a batch number." };
      const siblings = await getBatchSiblings(ctx.tenantId, sku, batch, "");
      return { count: siblings.length, complaints: siblings.map((c) => ({ case_number: c.case_number, title: c.title, severity: c.severity, opened: formatDate(c.created_at) })) };
    },
  },
  {
    name: "quality_kpis",
    description: "The brief's KPI table: acknowledgement SLA compliance, closed-loop rate, RCA SLA compliance, CAPA on-time completion, repeat issue rate.",
    input_schema: { type: "object", properties: {} },
    label: () => "Quality KPIs",
    run: async (ctx) => computeKpis(ctx.tenantId),
  },
  {
    name: "compensation_summary",
    description: "Every compensation (hamper or credit note) requested, grouped by status (requested, approved, fulfilled, declined).",
    input_schema: { type: "object", properties: {} },
    label: () => "Compensation summary",
    run: async (ctx) => {
      const supabase = await createClient();
      const { data } = await supabase.from(TABLES.complaintCompensations).select("type, status, amount_cents").eq("tenant_id", ctx.tenantId);
      const rows = data ?? [];
      const byStatus: Record<string, number> = {};
      for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      return { count: rows.length, by_status: byStatus };
    },
  },
];

export async function runTool(ctx: ToolContext, name: string, input: Record<string, unknown>): Promise<unknown> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { error: "Unknown tool." };
  try {
    return await tool.run(ctx, input);
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "That could not be worked out." };
  }
}
