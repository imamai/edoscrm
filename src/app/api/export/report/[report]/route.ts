import { NextResponse, type NextRequest } from "next/server";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { buildReport, isReportKey } from "@/lib/data/report-tables";
import { tableResponse, formatOf } from "@/lib/export/table";

/** One route, three formats — ?format=csv|xlsx|pdf, same table definition
 * behind all of them and behind the on-screen table, so a download always
 * matches what the report page shows. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!isReportKey(report)) return NextResponse.json({ error: "Unknown report." }, { status: 404 });

  const session = await resolveSession();
  if (session.kind !== "ok") return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await hasPermission(session.tenant.id, "complaints.export"))) {
    return NextResponse.json({ error: "You don't have permission to export reports." }, { status: 403 });
  }

  const format = formatOf(new URL(request.url).searchParams.get("format"));
  const table = await buildReport(report, session.tenant.id, session.tenant.name);
  return tableResponse(format, table);
}
