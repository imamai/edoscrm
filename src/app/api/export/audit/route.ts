import { NextResponse, type NextRequest } from "next/server";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getAuditLog } from "@/lib/data/audit";
import { getTenantMembers } from "@/lib/data/members";
import { resolvePeriod, parseReportFilters } from "@/lib/data/report-filters";
import { tableResponse, formatOf, type Cell } from "@/lib/export/table";
import { formatDateTime } from "@/lib/utils";

/**
 * Exportable audit records — the brief's §8 "Auditability" requirement, which
 * asks for a complete time-stamped history *and* for it to be exportable. The
 * permission existed with nothing behind it, so an auditor could not be handed
 * anything.
 *
 * Reads the same query string the audit screen uses, so a downloaded file is
 * always the rows that were on screen.
 */
export async function GET(request: NextRequest) {
  const session = await resolveSession();
  if (session.kind !== "ok") return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await hasPermission(session.tenant.id, "admin.audit.view"))) {
    return NextResponse.json({ error: "You don't have permission to export the audit log." }, { status: 403 });
  }

  const search = new URL(request.url).searchParams;
  const params = Object.fromEntries(search.entries());
  const period = resolvePeriod(parseReportFilters(params));

  const [entries, members] = await Promise.all([
    getAuditLog(session.tenant.id, {
      from: period.from,
      to: period.to,
      action: search.get("action") || undefined,
      q: search.get("q") || undefined,
    }),
    getTenantMembers(session.tenant.id),
  ]);
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const flatten = (v: Record<string, unknown> | null) =>
    v && Object.keys(v).length
      ? Object.entries(v)
          .map(([k, value]) => `${k}=${value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value)}`)
          .join("; ")
      : "";

  return tableResponse(formatOf(search.get("format")), {
    name: `audit-log-${new Date().toISOString().slice(0, 10)}`,
    title: "Audit log",
    tenantName: session.tenant.name,
    subtitle: `${entries.length} entries — ${period.label}`,
    header: ["When", "Who", "Action", "Record type", "Record", "Before", "After", "Reason"],
    rows: entries.map<Cell[]>((e) => [
      formatDateTime(e.created_at),
      e.actor_id ? (nameById.get(e.actor_id) ?? "Former member") : "System",
      e.action,
      e.entity_type,
      e.entity_id ?? "",
      flatten(e.before),
      flatten(e.after),
      e.reason ?? "",
    ]),
  });
}
