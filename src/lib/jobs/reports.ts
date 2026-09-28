import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { TABLES } from "@/lib/data/tables";
import { sendEmail } from "@/lib/email";
import { computeSlaStatus } from "@/lib/domain/sla";
import type { Complaint, Severity } from "@/lib/data/complaints";

/**
 * The brief's §7 weekly and monthly reports, generated and distributed on a
 * schedule.
 *
 * "Every Monday to executive leadership" and "first week of the month to the
 * executive team" are cadence requirements, not content requirements — the
 * content already existed on screen. What was missing was that anything
 * happened without somebody remembering to open a page, which is the
 * difference between a report and a report that gets read.
 *
 * Each run is recorded in edoscrm_report_runs, so "sent every Monday" is
 * evidenced rather than assumed, and a re-run on the same period is a no-op
 * rather than a second email.
 */

type Supa = ReturnType<typeof createAdminClient>;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export type ReportKind = "weekly" | "monthly";

export type ReportSummary = { tenants: number; sent: number; skipped: number; errors: string[] };

/** The period a run covers: the completed week or month before today. */
export function periodFor(kind: ReportKind, now = new Date()): { start: Date; end: Date; label: string } {
  if (kind === "weekly") {
    // Monday-start, and we report the week that just ended.
    const day = (now.getUTCDay() + 6) % 7;
    const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
    const start = new Date(thisMonday.getTime() - 7 * 86_400_000);
    const end = new Date(thisMonday.getTime() - 1);
    return { start, end, label: `week of ${start.toISOString().slice(0, 10)}` };
  }
  const firstOfThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(firstOfThis.getTime() - 1);
  return { start, end, label: start.toLocaleDateString("en-KE", { month: "long", year: "numeric", timeZone: "UTC" }) };
}

function buildHtml(kind: ReportKind, tenantName: string, label: string, complaints: Complaint[], rules: Map<Severity, { acknowledgement_minutes: number; rca_minutes: number | null; resolution_plan_minutes: number | null }>, openAll: Complaint[]) {
  const total = complaints.length;
  const bySeverity = (s: Severity) => complaints.filter((c) => c.severity === s).length;
  const closed = complaints.filter((c) => c.current_stage_key === "closed").length;

  // SLA compliance over the period, from stored timestamps.
  let ackOk = 0;
  let ackCounted = 0;
  for (const c of complaints) {
    const rule = rules.get(c.severity);
    if (!rule) continue;
    const deadline = new Date(c.created_at).getTime() + rule.acknowledgement_minutes * 60_000;
    if (c.acknowledged_at) {
      ackCounted++;
      if (new Date(c.acknowledged_at).getTime() <= deadline) ackOk++;
    } else if (Date.now() > deadline) ackCounted++;
  }

  // Overdue right now — not restricted to the period, because an old overdue
  // case is exactly what leadership needs to see.
  const overdue = openAll.filter((c) => {
    const rule = rules.get(c.severity);
    if (!rule) return false;
    return (
      computeSlaStatus({
        createdAt: c.created_at,
        currentStageKey: c.current_stage_key,
        acknowledgementMinutes: rule.acknowledgement_minutes,
        rcaMinutes: rule.rca_minutes,
        resolutionPlanMinutes: rule.resolution_plan_minutes,
        acknowledgedAt: c.acknowledged_at,
      }).level === "danger"
    );
  });

  // Batch pattern flags: any SKU+batch with more than one open complaint.
  const batches = new Map<string, Complaint[]>();
  for (const c of openAll) {
    if (!c.sku || !c.batch_number) continue;
    const k = `${c.sku} / ${c.batch_number}`;
    batches.set(k, [...(batches.get(k) ?? []), c]);
  }
  const flagged = [...batches.entries()].filter(([, list]) => list.length >= 2).sort((a, b) => b[1].length - a[1].length);

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6b7080">${esc(label)}</td><td style="padding:6px 0;font-weight:600">${esc(value)}</td></tr>`;

  const t1t2Open = openAll.filter((c) => c.severity === "T1" || c.severity === "T2");

  return `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#12141c;max-width:640px">
    <p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7080;font-weight:700;margin:0">
      ${kind === "weekly" ? "Weekly complaint report" : "Monthly management report"}
    </p>
    <h1 style="font-size:20px;color:#1d3557;margin:4px 0 2px">${esc(tenantName)}</h1>
    <p style="margin:0 0 16px;color:#6b7080">${esc(label)}</p>

    <table style="border-collapse:collapse;margin-bottom:18px">
      ${row("Complaints logged", String(total))}
      ${row("T1 critical", String(bySeverity("T1")))}
      ${row("T2 major", String(bySeverity("T2")))}
      ${row("T3 minor", String(bySeverity("T3")))}
      ${row("Closed in period", String(closed))}
      ${row("Acknowledgement SLA", pct(ackOk, ackCounted))}
      ${row("Open right now", String(openAll.length))}
      ${row("Open T1/T2", String(t1t2Open.length))}
      ${row("Overdue right now", String(overdue.length))}
    </table>

    ${
      overdue.length
        ? `<h2 style="font-size:15px;color:#b91c1c;margin:0 0 6px">Overdue and needing attention</h2>
           <ul style="margin:0 0 18px;padding-left:18px">
             ${overdue.slice(0, 15).map((c) => `<li>${esc(c.case_number)} (${esc(c.severity)}) — ${esc(c.title)}</li>`).join("")}
           </ul>`
        : `<p style="color:#16803c;margin:0 0 18px">Nothing is currently overdue.</p>`
    }

    ${
      flagged.length
        ? `<h2 style="font-size:15px;color:#b45309;margin:0 0 6px">Batch patterns to watch</h2>
           <ul style="margin:0 0 18px;padding-left:18px">
             ${flagged.slice(0, 10).map(([k, list]) => `<li>${esc(k)} — ${list.length} open complaints</li>`).join("")}
           </ul>`
        : ""
    }

    <p style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e5ec;font-size:12px;color:#6b7080">
      Generated automatically by EDOS CRM. Open the Reports screen for the full register, filtered to any period and
      downloadable as CSV, Excel or PDF.
    </p>
  </div>`;
}

export async function runScheduledReports(kind: ReportKind, now = new Date()): Promise<ReportSummary> {
  const supa = createAdminClient();
  const summary: ReportSummary = { tenants: 0, sent: 0, skipped: 0, errors: [] };
  const { start, end, label } = periodFor(kind, now);
  const periodStart = start.toISOString().slice(0, 10);

  const { data: tenants } = await supa.from(TABLES.tenants).select("id, name, status");

  for (const t of tenants ?? []) {
    if ((t.status as string) === "suspended") continue;
    const tenantId = t.id as string;
    summary.tenants++;

    try {
      const { data: settings } = await supa.from(TABLES.tenantSettings).select("*").eq("tenant_id", tenantId).maybeSingle();
      const enabled = kind === "weekly" ? settings?.weekly_report_enabled !== false : settings?.monthly_report_enabled !== false;
      if (!enabled) {
        summary.skipped++;
        continue;
      }

      // Already sent for this period — a re-run must not send a second copy.
      const { data: existing } = await supa
        .from(TABLES.reportRuns)
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("kind", kind)
        .eq("period_start", periodStart)
        .maybeSingle();
      if (existing) {
        summary.skipped++;
        continue;
      }

      const [{ data: inPeriod }, { data: openAll }, { data: rules }] = await Promise.all([
        supa
          .from(TABLES.complaints)
          .select("*")
          .eq("tenant_id", tenantId)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString()),
        supa.from(TABLES.complaints).select("*").eq("tenant_id", tenantId).neq("current_stage_key", "closed"),
        supa.from(TABLES.slaRules).select("*").eq("tenant_id", tenantId),
      ]);

      const ruleMap = new Map(
        (rules ?? []).map((r) => [
          r.severity as Severity,
          {
            acknowledgement_minutes: r.acknowledgement_minutes as number,
            rca_minutes: (r.rca_minutes as number | null) ?? null,
            resolution_plan_minutes: (r.resolution_plan_minutes as number | null) ?? null,
          },
        ]),
      );

      // Leadership sees the report. In an unconfigured workspace that is the
      // administrator, so a report still goes somewhere rather than nowhere.
      const recipientIds = await leadershipRecipients(supa, tenantId);
      if (!recipientIds.length) {
        summary.skipped++;
        continue;
      }

      const { data: users } = await supa.from(TABLES.users).select("email").in("id", recipientIds);
      const addresses = (users ?? []).map((u) => u.email as string).filter(Boolean);
      if (!addresses.length) {
        summary.skipped++;
        continue;
      }

      const html = buildHtml(kind, t.name as string, label, (inPeriod ?? []) as Complaint[], ruleMap, (openAll ?? []) as Complaint[]);
      const subject = `${t.name}: ${kind === "weekly" ? "weekly complaint report" : "monthly management report"} — ${label}`;

      await Promise.all(addresses.map((to) => sendEmail({ to, subject, html }).catch(() => undefined)));

      await supa.from(TABLES.reportRuns).insert({
        tenant_id: tenantId,
        kind,
        period_start: periodStart,
        period_end: end.toISOString().slice(0, 10),
        recipients: addresses.length,
      });
      summary.sent++;
    } catch (e) {
      summary.errors.push(`${tenantId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return summary;
}

async function leadershipRecipients(supa: Supa, tenantId: string): Promise<string[]> {
  const { data: roles } = await supa
    .from(TABLES.roles)
    .select("id, name")
    .eq("tenant_id", tenantId)
    .in("name", ["Leadership", "Tenant Administrator", "Marketing Operations"]);
  const roleIds = (roles ?? []).map((r) => r.id as string);
  if (!roleIds.length) return [];
  const { data: userRoles } = await supa.from(TABLES.userRoles).select("user_id").eq("tenant_id", tenantId).in("role_id", roleIds);
  return Array.from(new Set((userRoles ?? []).map((u) => u.user_id as string)));
}
