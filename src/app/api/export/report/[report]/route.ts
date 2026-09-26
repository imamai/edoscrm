import { NextResponse, type NextRequest } from "next/server";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { buildReport, isReportKey } from "@/lib/data/report-tables";
import { parseReportFilters } from "@/lib/data/report-filters";
import { tableResponse, formatOf } from "@/lib/export/table";

/** One route, three formats — ?format=csv|xlsx|pdf, same table definition
 * behind all of them and behind the on-screen table, so a download always
 * matches what the report page shows. The filter parameters are read from the
 * same query string the page uses, which is what keeps the two in step. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!isReportKey(report)) return NextResponse.json({ error: "Unknown report." }, { status: 404 });

  const session = await resolveSession();
  if (session.kind !== "ok") return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await hasPermission(session.tenant.id, "complaints.export"))) {
    return NextResponse.json({ error: "You don't have permission to export reports." }, { status: 403 });
  }

  const search = new URL(request.url).searchParams;
  const format = formatOf(search.get("format"));
  const filters = parseReportFilters(Object.fromEntries(search.entries()));
  const { table } = await buildReport(report, session.tenant.id, session.tenant.name, filters);
  return tableResponse(format, table);
}
