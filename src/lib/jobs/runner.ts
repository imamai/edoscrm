import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { TABLES } from "@/lib/data/tables";
import { sendEmail } from "@/lib/email";
import { computeSlaStatus } from "@/lib/domain/sla";
import { computeBatchEscalation, BRIEF_THRESHOLDS, type EscalationThresholds } from "@/lib/domain/escalation";
import type { Complaint, Severity } from "@/lib/data/complaints";

/**
 * The work that has to happen whether or not anybody opens the application.
 *
 * Before this existed, every time-based rule in the brief was inert: SLA
 * reminders never fired, overdue cases escalated to nobody, and a batch that
 * crossed a threshold through the passage of time alone was never re-checked,
 * because escalation was only evaluated at the moment a complaint was logged.
 * The brief's central promise — that a Friday-afternoon complaint stops being
 * invisible until Monday — depends entirely on something running on a clock.
 *
 * Runs with the service-role client: there is no signed-in user on a scheduled
 * request, so no RLS policy could ever let it read across tenants as itself.
 * Everything here is therefore explicitly scoped by tenant_id in each query.
 */

type Supa = ReturnType<typeof createAdminClient>;

export type JobSummary = {
  slaWarnings: number;
  slaBreaches: number;
  overdueEscalations: number;
  batchEscalations: number;
  retentionPurged: number;
  tenants: number;
  errors: string[];
};

/** Don't tell the same people about the same case twice in one day. The
 * notification row is the record of what has already been said. */
async function alreadyNotified(supa: Supa, tenantId: string, complaintId: string, marker: string, sinceHours = 20) {
  const since = new Date(Date.now() - sinceHours * 3_600_000).toISOString();
  const { data } = await supa
    .from(TABLES.notifications)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("complaint_id", complaintId)
    .ilike("message", `%${marker}%`)
    .gte("created_at", since)
    .limit(1);
  return (data ?? []).length > 0;
}

async function usersWithPermission(supa: Supa, tenantId: string, permissionKey: string): Promise<string[]> {
  const { data: permission } = await supa.from(TABLES.permissions).select("id").eq("key", permissionKey).maybeSingle();
  if (!permission) return [];
  const { data: rolePerms } = await supa.from(TABLES.rolePermissions).select("role_id").eq("permission_id", permission.id);
  const roleIds = (rolePerms ?? []).map((r) => r.role_id as string);
  if (!roleIds.length) return [];
  const { data: userRoles } = await supa
    .from(TABLES.userRoles)
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("role_id", roleIds);
  return Array.from(new Set((userRoles ?? []).map((u) => u.user_id as string)));
}

async function notify(supa: Supa, tenantId: string, userIds: string[], message: string, complaintId: string | null) {
  const ids = Array.from(new Set(userIds));
  if (!ids.length) return;

  await supa.from(TABLES.notifications).insert(
    ids.map((user_id) => ({ tenant_id: tenantId, user_id, complaint_id: complaintId, message })),
  );

  const { data: recipients } = await supa.from(TABLES.users).select("email, full_name").in("id", ids);
  await Promise.all(
    (recipients ?? [])
      .filter((r) => r.email)
      .map((r) =>
        sendEmail({
          to: r.email as string,
          subject: `EDOS CRM: ${message.slice(0, 120)}`,
          html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6">
                   <p>${message}</p>
                 </div>`,
        }).catch(() => undefined),
      ),
  );
}

/**
 * SLA approach and breach notices, plus escalation of an overdue case to the
 * next accountable owner.
 *
 * "Next accountable owner" is read from permissions rather than a hard-coded
 * hierarchy: a breach goes to whoever can actually act on it — the people who
 * can close and assign — which in a configured workspace is Marketing
 * Operations, and in an unconfigured one is at least the administrator.
 */
async function runSlaPass(supa: Supa, tenantId: string, summary: JobSummary) {
  const [{ data: complaints }, { data: rules }] = await Promise.all([
    supa.from(TABLES.complaints).select("*").eq("tenant_id", tenantId).neq("current_stage_key", "closed"),
    supa.from(TABLES.slaRules).select("*").eq("tenant_id", tenantId),
  ]);
  if (!complaints?.length) return;

  const ruleBySeverity = new Map((rules ?? []).map((r) => [r.severity as Severity, r]));
  const owners = await usersWithPermission(supa, tenantId, "complaints.close");
  const assignOwners = await usersWithPermission(supa, tenantId, "complaints.assign");
  const escalationTargets = Array.from(new Set([...owners, ...assignOwners]));

  for (const raw of complaints) {
    const c = raw as Complaint;
    const rule = ruleBySeverity.get(c.severity);
    if (!rule) continue;

    const status = computeSlaStatus({
      createdAt: c.created_at,
      currentStageKey: c.current_stage_key,
      acknowledgementMinutes: rule.acknowledgement_minutes as number,
      rcaMinutes: (rule.rca_minutes as number | null) ?? null,
      resolutionPlanMinutes: (rule.resolution_plan_minutes as number | null) ?? null,
      acknowledgedAt: c.acknowledged_at,
    });

    if (status.level === "good") continue;

    // A case waiting on the complainant is not the team's delay. It still
    // shows as at-risk on screen, but nobody is chased for it.
    if (c.pending_information) continue;

    const marker = status.level === "danger" ? "[sla-breach]" : "[sla-due]";
    if (await alreadyNotified(supa, tenantId, c.id, marker)) continue;

    const recipients = c.assignee_id ? [c.assignee_id] : escalationTargets;

    if (status.level === "danger") {
      // An overdue case goes to the assignee *and* upward, because the point
      // of escalation is that it stops depending on the person who is already
      // late. The brief: "escalated automatically to the next accountable owner".
      const all = Array.from(new Set([...recipients, ...escalationTargets]));
      await notify(supa, tenantId, all, `${marker} ${c.case_number} (${c.severity}) — ${status.label}`, c.id);
      summary.slaBreaches++;
      summary.overdueEscalations++;
    } else {
      await notify(supa, tenantId, recipients, `${marker} ${c.case_number} (${c.severity}) — ${status.label}`, c.id);
      summary.slaWarnings++;
    }
  }
}

/**
 * Re-check batch thresholds over time.
 *
 * Escalation used to be evaluated only when a complaint was logged, so three
 * complaints arriving over two days crossed the 48-hour threshold without
 * anything noticing — the window moves even when nothing is filed.
 */
async function runBatchPass(supa: Supa, tenantId: string, thresholds: EscalationThresholds, summary: JobSummary) {
  const { data: complaints } = await supa
    .from(TABLES.complaints)
    .select("*")
    .eq("tenant_id", tenantId)
    .neq("current_stage_key", "closed")
    .not("sku", "is", null)
    .not("batch_number", "is", null);
  if (!complaints?.length) return;

  const byBatch = new Map<string, Complaint[]>();
  for (const raw of complaints) {
    const c = raw as Complaint;
    const key = `${c.sku}|${c.batch_number}`;
    byBatch.set(key, [...(byBatch.get(key) ?? []), c]);
  }

  const targets = Array.from(
    new Set([
      ...(await usersWithPermission(supa, tenantId, "investigations.manage")),
      ...(await usersWithPermission(supa, tenantId, "complaints.close")),
    ]),
  );

  for (const [, group] of byBatch) {
    if (group.length < 2) continue;
    // Evaluate from the newest complaint's point of view, with the rest as
    // its siblings — the same shape the case screen uses.
    const [newest, ...siblings] = [...group].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const escalation = computeBatchEscalation(siblings, newest.severity, thresholds);
    if (escalation.level === "none" || escalation.level === "warning") continue;

    const marker = `[batch-${escalation.level}]`;
    if (await alreadyNotified(supa, tenantId, newest.id, marker, 24 * 7)) continue;

    await notify(supa, tenantId, targets, `${marker} ${newest.sku}/${newest.batch_number}: ${escalation.message}`, newest.id);
    summary.batchEscalations++;
  }
}

/**
 * Retention: remove complainant contact details from closed cases older than
 * the workspace's retention period.
 *
 * The complaint itself is never deleted — the brief forbids it, and the
 * quality record is what the whole system exists to keep. What goes is the
 * personal data attached to it, which is what a retention obligation is
 * actually about.
 */
async function runRetentionPass(supa: Supa, tenantId: string, retentionDays: number | null, summary: JobSummary) {
  if (!retentionDays || retentionDays <= 0) return;
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();

  const { data: stale } = await supa
    .from(TABLES.complaints)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("current_stage_key", "closed")
    .lt("closed_at", cutoff)
    .not("reporter_email", "is", null)
    .limit(500);
  if (!stale?.length) return;

  const ids = stale.map((r) => r.id as string);
  const { error } = await supa
    .from(TABLES.complaints)
    .update({ reporter_email: null, reporter_phone: null, reporter_name: "[removed under retention policy]" })
    .in("id", ids);
  if (error) {
    summary.errors.push(`retention (${tenantId}): ${error.message}`);
    return;
  }
  summary.retentionPurged += ids.length;
}

/** One pass over every workspace. */
export async function runScheduledPass(): Promise<JobSummary> {
  const supa = createAdminClient();
  const summary: JobSummary = {
    slaWarnings: 0,
    slaBreaches: 0,
    overdueEscalations: 0,
    batchEscalations: 0,
    retentionPurged: 0,
    tenants: 0,
    errors: [],
  };

  const { data: tenants } = await supa.from(TABLES.tenants).select("id, status");
  for (const t of tenants ?? []) {
    if ((t.status as string) === "suspended") continue;
    const tenantId = t.id as string;
    summary.tenants++;

    const { data: settings } = await supa.from(TABLES.tenantSettings).select("*").eq("tenant_id", tenantId).maybeSingle();
    const thresholds: EscalationThresholds = settings
      ? {
          warn_count: settings.warn_count as number,
          warn_hours: settings.warn_hours as number,
          escalate_count: settings.escalate_count as number,
          escalate_hours: settings.escalate_hours as number,
          mandatory_rca_count: settings.mandatory_rca_count as number,
          mandatory_rca_hours: settings.mandatory_rca_hours as number,
          withdrawal_count: settings.withdrawal_count as number,
          withdrawal_hours: settings.withdrawal_hours as number,
          t3_escalate_count: settings.t3_escalate_count as number,
          t3_escalate_days: settings.t3_escalate_days as number,
        }
      : BRIEF_THRESHOLDS;

    // One failing workspace must not stop the others being processed.
    try {
      await runSlaPass(supa, tenantId, summary);
      await runBatchPass(supa, tenantId, thresholds, summary);
      await runRetentionPass(supa, tenantId, (settings?.retention_days as number | null) ?? null, summary);
    } catch (e) {
      summary.errors.push(`${tenantId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return summary;
}
