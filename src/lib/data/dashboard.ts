import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import { getComplaints, type Complaint } from "@/lib/data/complaints";
import { getSlaRules } from "@/lib/data/sla";
import { computeSlaStatus } from "@/lib/domain/sla";
import { getTasks } from "@/lib/data/tasks";

export type AttentionItem = { complaint: Complaint; reason: string };

export type RecentEvent = {
  id: string;
  complaint_id: string;
  case_number: string;
  event_type: string;
  actor_name: string;
  created_at: string;
};

export type DashboardData = {
  openCount: number;
  t1Count: number;
  overdueCount: number;
  tasksOverdueCount: number;
  attention: AttentionItem[];
  recentEvents: RecentEvent[];
  /** All complaints — the dashboard's chart row builds its own series from
   * this rather than a second identical query. */
  complaints: Complaint[];
};

/**
 * One dashboard, not per-role variants (ARCHITECTURE.md §9) — the only two
 * roles that exist so far (Tenant Administrator, Member) don't have
 * differentiated permission sets yet, so a "Quality" or "Manufacturing" view
 * would be guessing at a role that isn't real. Answers "what needs my
 * attention" first, per the brief's own dashboard philosophy (§11), not a
 * wall of charts.
 */
export async function getDashboardData(tenantId: string): Promise<DashboardData> {
  const [complaints, slaRules, tasks] = await Promise.all([
    getComplaints(tenantId),
    getSlaRules(tenantId),
    getTasks(tenantId),
  ]);

  const open = complaints.filter((c) => c.current_stage_key !== "closed");
  const t1Count = open.filter((c) => c.severity === "T1").length;

  const attention: AttentionItem[] = [];
  for (const c of open) {
    const rule = slaRules[c.severity];
    if (!rule) continue;
    const status = computeSlaStatus({
      createdAt: c.created_at,
      currentStageKey: c.current_stage_key,
      acknowledgementMinutes: rule.acknowledgement_minutes,
      rcaMinutes: rule.rca_minutes,
      resolutionPlanMinutes: rule.resolution_plan_minutes,
      acknowledgedAt: c.acknowledged_at,
    });
    if (status.level !== "good") attention.push({ complaint: c, reason: status.label });
  }
  // Worst first: overdue before at-risk, then by severity.
  attention.sort((a, b) => {
    const aOverdue = a.reason.includes("overdue");
    const bOverdue = b.reason.includes("overdue");
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return a.complaint.severity.localeCompare(b.complaint.severity);
  });

  const today = new Date().toISOString().slice(0, 10);
  const tasksOverdueCount = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length;

  const supabase = await createClient();
  const { data: events } = await supabase
    .from(TABLES.complaintEvents)
    .select("id, complaint_id, actor_id, event_type, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(8);

  const caseNumberById = new Map(complaints.map((c) => [c.id, c.case_number]));
  const actorIds = [...new Set((events ?? []).map((e) => e.actor_id).filter((v): v is string => Boolean(v)))];
  const actorName = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase.from(TABLES.users).select("id, full_name, email").in("id", actorIds);
    for (const actor of actors ?? []) actorName.set(actor.id, actor.full_name ?? actor.email);
  }

  const recentEvents: RecentEvent[] = (events ?? []).map((e) => ({
    id: e.id,
    complaint_id: e.complaint_id,
    case_number: caseNumberById.get(e.complaint_id) ?? "—",
    event_type: e.event_type,
    actor_name: (e.actor_id && actorName.get(e.actor_id)) ?? "Someone",
    created_at: e.created_at,
  }));

  return {
    openCount: open.length,
    t1Count,
    overdueCount: attention.filter((a) => a.reason.includes("overdue")).length,
    tasksOverdueCount,
    attention: attention.slice(0, 8),
    recentEvents,
    complaints,
  };
}
