"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDefaultWorkflowVersion } from "@/lib/data/workflows";
import { TABLES } from "@/lib/data/tables";

export type ImportState = {
  error: string | null;
  imported: number | null;
  skipped: number;
};

/** Brief §6 "Data migration": import agreed-on open and historical cases
 * from current/interim sources. Expects a simple CSV with a header row —
 * title,description,severity,category,product_name,sku,batch_number,
 * production_date,expiry_date,reporter_name,reporter_email,reporter_phone,
 * status — matching the fields this system actually has a place for, not
 * a mapping tool for arbitrary legacy formats (Sales/Marketing agreeing on
 * a column layout beforehand is the brief's own "agreed on" qualifier).
 * Every imported row gets its own real case number and an audit-visible
 * `import.created` event, never a silent bulk insert. */
export async function importComplaints(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await resolveSession();
  if (session.kind !== "ok")
    return { error: "Your session has expired.", imported: null, skipped: 0 };
  if (!(await hasPermission(session.tenant.id, "complaints.import"))) {
    return {
      error: "You don't have permission to import complaints.",
      imported: null,
      skipped: 0,
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File))
    return { error: "Choose a CSV file first.", imported: null, skipped: 0 };

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2)
    return { error: "That file has no data rows.", imported: null, skipped: 0 };

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map(parseCsvLine);

  const workflow = await getDefaultWorkflowVersion(session.tenant.id);
  if (!workflow)
    return {
      error: "This workspace has no workflow set up yet.",
      imported: null,
      skipped: 0,
    };
  const firstStage = workflow.definition.stages[0]?.key;
  const validStages = new Set(workflow.definition.stages.map((s) => s.key));
  if (!firstStage)
    return {
      error: "This workflow has no stages.",
      imported: null,
      skipped: 0,
    };

  const supabase = await createClient();
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => (record[h] = (row[i] ?? "").trim()));
    if (!record.title) {
      skipped++;
      continue;
    }

    const { data: caseNumber, error: numberError } = await supabase.rpc(
      "edoscrm_next_case_number",
      {
        p_tenant_id: session.tenant.id,
      },
    );
    if (numberError || !caseNumber) {
      skipped++;
      continue;
    }

    const severity = ["T1", "T2", "T3"].includes(record.severity)
      ? record.severity
      : "T3";
    const stageKey = validStages.has(record.status)
      ? record.status
      : firstStage;

    const { data: complaint, error: insertError } = await supabase
      .from(TABLES.complaints)
      .insert({
        tenant_id: session.tenant.id,
        case_number: caseNumber,
        title: record.title,
        description: record.description || null,
        severity,
        source: "internal",
        category: record.category || null,
        product_name: record.product_name || null,
        sku: record.sku || null,
        batch_number: record.batch_number || null,
        production_date: record.production_date || null,
        expiry_date: record.expiry_date || null,
        reporter_name: record.reporter_name || null,
        reporter_email: record.reporter_email || null,
        reporter_phone: record.reporter_phone || null,
        workflow_version_id: workflow.id,
        current_stage_key: stageKey,
        created_by: session.user.id,
        closed_at: stageKey === "closed" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (insertError || !complaint) {
      skipped++;
      continue;
    }

    await supabase.from(TABLES.complaintEvents).insert({
      tenant_id: session.tenant.id,
      complaint_id: complaint.id,
      actor_id: session.user.id,
      event_type: "import.created",
      payload: { stage: stageKey, severity, source_file: file.name },
    });
    imported++;
  }

  return { error: null, imported, skipped };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}
