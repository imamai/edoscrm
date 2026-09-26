import { NextResponse, type NextRequest } from "next/server";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getComplaints, type Channel, type Severity } from "@/lib/data/complaints";

/** Brief §6 "Should — Export": filtered data to Excel/PDF without losing
 * field labels. CSV opens natively in Excel with headers intact, which is
 * what "without losing field labels" actually asks for — a real .xlsx
 * binary would need a library with no other use in this codebase yet.
 *
 * Same CSV-formula-injection guard as EDOSPMIS's lib/export/csv.ts: a cell
 * starting with = + - or @ gets an apostrophe prefix, or a complainant/
 * product name typed as `=HYPERLINK(...)` would run as a live formula the
 * moment someone opens the file in Excel. Found and fixed as part of this
 * security pass — the original version here only escaped quotes/commas. */
function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const session = await resolveSession();
  if (session.kind !== "ok") return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!(await hasPermission(session.tenant.id, "complaints.export"))) {
    return NextResponse.json({ error: "You don't have permission to export complaints." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const complaints = await getComplaints(session.tenant.id, {
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    severity: (searchParams.get("severity") as Severity | null) ?? undefined,
    channel: (searchParams.get("channel") as Channel | null) ?? undefined,
    category: searchParams.get("category") ?? undefined,
  });

  const headers = [
    "case_number", "title", "category", "severity", "current_stage_key", "source",
    "product_name", "sku", "batch_number", "production_date", "expiry_date",
    "reporter_name", "reporter_email", "reporter_phone",
    "pending_information", "created_at", "closed_at",
  ];
  const rows = complaints.map((c) => headers.map((h) => toCsvValue((c as unknown as Record<string, unknown>)[h])).join(","));
  // Leading BOM so Excel reads this as UTF-8 instead of Windows-1252 — an
  // accented complainant name would otherwise arrive as mojibake.
  const csv = "﻿" + [headers.join(","), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="complaints-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
