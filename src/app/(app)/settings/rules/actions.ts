"use server";

import { revalidatePath } from "next/cache";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { updateSlaRule } from "@/lib/data/sla";
import { addCategory, setCategoryActive, updateKpiTarget, updateTenantSettings, getTenantSettings } from "@/lib/data/settings";
import { writeAudit } from "@/lib/data/audit";
import type { Severity } from "@/lib/data/complaints";

async function guard() {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "admin.settings.manage"))) {
    return { ok: false as const, error: "You don't have permission to change workspace rules." };
  }
  return { ok: true as const, session };
}

/** A blank deadline means "no deadline", which is a real setting — T3 has no
 * RCA deadline because the brief asks only that a minor complaint be logged,
 * acknowledged and reviewed weekly. Zero would mean "instantly overdue". */
function minutesOrNull(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export async function saveSlaAction(formData: FormData) {
  const g = await guard();
  if (!g.ok) return g;

  for (const severity of ["T1", "T2", "T3"] as Severity[]) {
    const ack = minutesOrNull(formData.get(`${severity}_ack`));
    if (!ack) return { ok: false as const, error: `${severity} needs an acknowledgement deadline.` };
    const result = await updateSlaRule(g.session.tenant.id, severity, {
      acknowledgement_minutes: ack,
      rca_minutes: minutesOrNull(formData.get(`${severity}_rca`)),
      resolution_plan_minutes: minutesOrNull(formData.get(`${severity}_plan`)),
    });
    if (!result.ok) return result;
  }

  await writeAudit({
    tenantId: g.session.tenant.id,
    actorId: g.session.user.id,
    action: "settings.sla.changed",
    entityType: "sla_rules",
  });
  revalidatePath("/settings/rules");
  return { ok: true as const };
}

export async function saveThresholdsAction(formData: FormData) {
  const g = await guard();
  if (!g.ok) return g;

  const num = (name: string, fallback: number) => {
    const n = Number(String(formData.get(name) ?? "").trim());
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  };

  const before = await getTenantSettings(g.session.tenant.id);
  const values = {
    warn_count: num("warn_count", before.warn_count),
    warn_hours: num("warn_hours", before.warn_hours),
    escalate_count: num("escalate_count", before.escalate_count),
    escalate_hours: num("escalate_hours", before.escalate_hours),
    mandatory_rca_count: num("mandatory_rca_count", before.mandatory_rca_count),
    mandatory_rca_hours: num("mandatory_rca_hours", before.mandatory_rca_hours),
    withdrawal_count: num("withdrawal_count", before.withdrawal_count),
    withdrawal_hours: num("withdrawal_hours", before.withdrawal_hours),
    t3_escalate_count: num("t3_escalate_count", before.t3_escalate_count),
    t3_escalate_days: num("t3_escalate_days", before.t3_escalate_days),
  };

  // A warning that needs more complaints than an escalation would never fire,
  // and the escalation would fire first — which is not what anyone means by
  // "warn me before you escalate".
  if (values.warn_count >= values.escalate_count) {
    return { ok: false as const, error: "The warning threshold has to be lower than the escalation threshold." };
  }
  if (values.escalate_count >= values.mandatory_rca_count) {
    return { ok: false as const, error: "The escalation threshold has to be lower than the mandatory-RCA threshold." };
  }
  if (values.mandatory_rca_count >= values.withdrawal_count) {
    return { ok: false as const, error: "The mandatory-RCA threshold has to be lower than the withdrawal threshold." };
  }

  const result = await updateTenantSettings(g.session.tenant.id, values);
  if (!result.ok) return result;

  await writeAudit({
    tenantId: g.session.tenant.id,
    actorId: g.session.user.id,
    action: "settings.escalation.changed",
    entityType: "tenant_settings",
    before: { ...before },
    after: values,
  });
  revalidatePath("/settings/rules");
  return { ok: true as const };
}

export async function saveOperationsAction(formData: FormData) {
  const g = await guard();
  if (!g.ok) return g;

  const retentionRaw = String(formData.get("retention_days") ?? "").trim();
  const retention = retentionRaw ? Number(retentionRaw) : null;
  if (retentionRaw && (!Number.isFinite(retention!) || retention! < 30)) {
    return { ok: false as const, error: "A retention period needs to be at least 30 days, or blank to keep data indefinitely." };
  }

  const before = await getTenantSettings(g.session.tenant.id);
  const values = {
    retention_days: retention,
    auto_acknowledge: formData.get("auto_acknowledge") === "on",
    weekly_report_enabled: formData.get("weekly_report_enabled") === "on",
    monthly_report_enabled: formData.get("monthly_report_enabled") === "on",
  };

  const result = await updateTenantSettings(g.session.tenant.id, values);
  if (!result.ok) return result;

  await writeAudit({
    tenantId: g.session.tenant.id,
    actorId: g.session.user.id,
    action: "settings.operations.changed",
    entityType: "tenant_settings",
    before: {
      retention_days: before.retention_days,
      auto_acknowledge: before.auto_acknowledge,
      weekly_report_enabled: before.weekly_report_enabled,
      monthly_report_enabled: before.monthly_report_enabled,
    },
    after: values,
  });
  revalidatePath("/settings/rules");
  return { ok: true as const };
}

export async function saveTargetsAction(formData: FormData) {
  const g = await guard();
  if (!g.ok) return g;

  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("target_")) continue;
    const key = name.slice("target_".length);
    const raw = String(value).trim();
    const pct = raw ? Number(raw) : null;
    if (raw && (!Number.isFinite(pct!) || pct! < 0 || pct! > 100)) {
      return { ok: false as const, error: "Targets are percentages between 0 and 100." };
    }
    const result = await updateKpiTarget(g.session.tenant.id, key, pct);
    if (!result.ok) return result;
  }

  await writeAudit({
    tenantId: g.session.tenant.id,
    actorId: g.session.user.id,
    action: "settings.targets.changed",
    entityType: "kpi_targets",
  });
  revalidatePath("/settings/rules");
  revalidatePath("/analytics");
  return { ok: true as const };
}

export async function addCategoryAction(name: string) {
  const g = await guard();
  if (!g.ok) return g;
  if (!name.trim()) return { ok: false as const, error: "Give the category a name." };

  const result = await addCategory(g.session.tenant.id, name);
  if (!result.ok) {
    return { ok: false as const, error: result.error.includes("duplicate") ? "That category already exists." : result.error };
  }
  await writeAudit({
    tenantId: g.session.tenant.id,
    actorId: g.session.user.id,
    action: "settings.category.added",
    entityType: "category",
    after: { name: name.trim() },
  });
  revalidatePath("/settings/rules");
  return { ok: true as const };
}

export async function setCategoryActiveAction(id: string, isActive: boolean) {
  const g = await guard();
  if (!g.ok) return g;

  const result = await setCategoryActive(g.session.tenant.id, id, isActive);
  if (!result.ok) return result;

  await writeAudit({
    tenantId: g.session.tenant.id,
    actorId: g.session.user.id,
    action: isActive ? "settings.category.restored" : "settings.category.retired",
    entityType: "category",
    entityId: id,
  });
  revalidatePath("/settings/rules");
  return { ok: true as const };
}
