import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TABLES } from "@/lib/data/tables";

/**
 * Public complaint intake (ARCHITECTURE.md §8) — the one endpoint on this
 * whole product with no session behind it. Every EDOS website eventually
 * posts here. Three rules that don't apply anywhere else in the app:
 *
 *  1. Uses the service-role client throughout — an anonymous reporter has
 *     no edoscrm_users row and no membership, so no RLS policy in the
 *     project could ever let this insert through as itself.
 *  2. Never returns anything beyond a case number. No investigation data,
 *     no internal comments, no RCA — an intake response is write-only from
 *     the caller's point of view.
 *  3. Rate-limited by (tenant, IP) since it's the one door into this
 *     project a stranger can knock on. DB-backed rather than an external
 *     store — fine for now; a real production deployment fielding public
 *     traffic should move this to Upstash/Vercel's edge rate limiting
 *     instead of counting rows on every request.
 */

const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX = 5;

export async function POST(request: NextRequest) {
  let body: {
    workspace?: string;
    title?: string;
    description?: string;
    reporter_name?: string;
    reporter_email?: string;
    reporter_phone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const workspace = (body.workspace ?? "").trim();
  const title = (body.title ?? "").trim().slice(0, 300);
  const description = (body.description ?? "").trim().slice(0, 5000) || null;
  const reporterName = (body.reporter_name ?? "").trim().slice(0, 200) || null;
  const reporterEmail = (body.reporter_email ?? "").trim().slice(0, 200) || null;
  const reporterPhone = (body.reporter_phone ?? "").trim().slice(0, 50) || null;

  if (!workspace || !title) {
    return NextResponse.json({ error: "workspace and title are required." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const admin = createAdminClient();

  const { data: tenant } = await admin.from(TABLES.tenants).select("id").eq("slug", workspace).maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: "Unknown workspace." }, { status: 404 });
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await admin
    .from(TABLES.complaints)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("source_ip", ip)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  const { data: workflow } = await admin
    .from(TABLES.workflows)
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("is_default", true)
    .maybeSingle();
  const { data: workflowVersion } = workflow
    ? await admin
        .from(TABLES.workflowVersions)
        .select("id, definition")
        .eq("workflow_id", workflow.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const firstStage = (workflowVersion?.definition as { stages?: { key: string }[] } | undefined)?.stages?.[0]?.key;
  if (!workflowVersion || !firstStage) {
    return NextResponse.json({ error: "This workspace is not accepting complaints yet." }, { status: 503 });
  }

  const { data: caseNumber, error: numberError } = await admin.rpc("edoscrm_next_case_number_public", {
    p_tenant_id: tenant.id,
  });
  if (numberError || !caseNumber) {
    return NextResponse.json({ error: "Could not register this complaint. Try again shortly." }, { status: 500 });
  }

  // Public submissions always start at T3 — severity classification is a
  // staff triage decision (brief §12's Triage stage), not something a
  // reporter self-assesses on the way in.
  const { data: complaint, error: insertError } = await admin
    .from(TABLES.complaints)
    .insert({
      tenant_id: tenant.id,
      case_number: caseNumber,
      title,
      description,
      severity: "T3",
      workflow_version_id: workflowVersion.id,
      current_stage_key: firstStage,
      source: "web",
      reporter_name: reporterName,
      reporter_email: reporterEmail,
      reporter_phone: reporterPhone,
      source_ip: ip,
    })
    .select("id, case_number")
    .single();

  if (insertError || !complaint) {
    return NextResponse.json({ error: "Could not register this complaint. Try again shortly." }, { status: 500 });
  }

  await admin.from(TABLES.complaintEvents).insert({
    tenant_id: tenant.id,
    complaint_id: complaint.id,
    actor_id: null,
    event_type: "complaint.created",
    payload: { stage: firstStage, severity: "T3", source: "web" },
  });

  return NextResponse.json({ case_number: complaint.case_number }, { status: 201 });
}
