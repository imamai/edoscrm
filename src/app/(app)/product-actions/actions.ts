"use server";

import { revalidatePath } from "next/cache";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createProductAction, decideProductAction, type ProductActionKind } from "@/lib/data/product-actions";
import { notifyUsers, usersWithPermission } from "@/lib/data/notifications";
import { writeAudit } from "@/lib/data/audit";

export async function requestProductAction(values: {
  action: ProductActionKind;
  sku: string | null;
  batchNumber: string | null;
  productName: string | null;
  reason: string;
  complaintIds: string[];
}) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "product.action.request"))) {
    return { ok: false as const, error: "You don't have permission to raise a product action." };
  }
  if (!values.reason.trim()) return { ok: false as const, error: "Say why this action is needed." };
  if (!values.sku?.trim() && !values.batchNumber?.trim()) {
    return { ok: false as const, error: "A product action needs at least a SKU or a batch number." };
  }

  const created = await createProductAction(session.tenant.id, { ...values, requestedBy: session.user.id });
  if (!created.ok) return created;

  await writeAudit({
    tenantId: session.tenant.id,
    actorId: session.user.id,
    action: `product.${values.action}.requested`,
    entityType: "product_action",
    entityId: created.id,
    after: { sku: values.sku, batch: values.batchNumber, complaints: values.complaintIds.length },
    reason: values.reason.trim(),
  });

  // Whoever can decide it needs to know it is waiting — a recall request that
  // sits unseen is worse than not raising one, because it looks handled.
  const approvers = await usersWithPermission(session.tenant.id, "product.action.approve");
  if (approvers.length) {
    await notifyUsers(
      session.tenant.id,
      approvers,
      `Product ${values.action} requested for ${values.sku ?? ""}${values.batchNumber ? `/${values.batchNumber}` : ""} — a decision is needed`,
    );
  }

  revalidatePath("/product-actions");
  return { ok: true as const, notifiedApprovers: approvers.length };
}

export async function decideProductActionAction(id: string, decision: "approved" | "declined", note: string) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "product.action.approve"))) {
    return { ok: false as const, error: "You don't have permission to decide product actions." };
  }
  if (decision === "declined" && !note.trim()) {
    return { ok: false as const, error: "Say why this is being declined — a refused recall needs its reasoning on record." };
  }

  const result = await decideProductAction(session.tenant.id, id, decision, session.user.id, note.trim());
  if (!result.ok) return result;

  await writeAudit({
    tenantId: session.tenant.id,
    actorId: session.user.id,
    action: `product.action.${decision}`,
    entityType: "product_action",
    entityId: id,
    after: { status: decision },
    reason: note.trim() || null,
  });

  const requesters = await usersWithPermission(session.tenant.id, "product.action.request");
  if (requesters.length) {
    await notifyUsers(session.tenant.id, requesters, `A product action was ${decision}.`);
  }

  revalidatePath("/product-actions");
  return { ok: true as const };
}
