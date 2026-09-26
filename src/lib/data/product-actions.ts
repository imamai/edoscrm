import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

/**
 * Product hold, release, withdrawal and recall decisions.
 *
 * The brief requires "approval for product hold, release, withdrawal or recall
 * decisions", and this is the most consequential decision in the whole process
 * — and the one most likely to be examined afterwards. Previously a ten-plus
 * batch pattern raised a "withdrawal assessment" alert and then nothing: no
 * decision record, no approver, no evidence, no permission governing who could
 * make the call.
 *
 * The brief splits the responsibility: Quality "informs" hold/release/
 * withdrawal, Manufacturing "decides" it. That is why requesting and approving
 * are separate permissions rather than one.
 */

export { ACTION_LABEL } from "@/lib/domain/product-actions";
export type { ProductAction, ProductActionKind, ProductActionStatus } from "@/lib/domain/product-actions";
import type { ProductAction, ProductActionKind, ProductActionStatus } from "@/lib/domain/product-actions";

export async function getProductActions(tenantId: string, status?: ProductActionStatus): Promise<ProductAction[]> {
  const supabase = await createClient();
  let q = supabase.from(TABLES.productActions).select("*").eq("tenant_id", tenantId);
  if (status) q = q.eq("status", status);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as ProductAction[];
}

export async function createProductAction(
  tenantId: string,
  values: {
    action: ProductActionKind;
    sku: string | null;
    batchNumber: string | null;
    productName: string | null;
    reason: string;
    complaintIds: string[];
    requestedBy: string;
  },
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES.productActions)
    .insert({
      tenant_id: tenantId,
      action: values.action,
      sku: values.sku,
      batch_number: values.batchNumber,
      product_name: values.productName,
      reason: values.reason,
      complaint_ids: values.complaintIds,
      requested_by: values.requestedBy,
    })
    .select("id")
    .maybeSingle();
  return error ? { ok: false as const, error: error.message } : { ok: true as const, id: data?.id as string };
}

export async function decideProductAction(
  tenantId: string,
  id: string,
  decision: "approved" | "declined",
  approvedBy: string,
  note: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.productActions)
    .update({ status: decision, approved_by: approvedBy, decided_at: new Date().toISOString(), decision_note: note || null })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    // Only a request that is still open can be decided — this stops a second
    // approver overwriting the first one's decision.
    .eq("status", "requested");
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/** Batches with more than one open complaint, offered as the starting point
 * for a request — the evidence is what makes the decision defensible. */
export async function getBatchesNeedingAttention(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.complaints)
    .select("id, case_number, title, sku, batch_number, product_name, severity, created_at")
    .eq("tenant_id", tenantId)
    .neq("current_stage_key", "closed")
    .not("sku", "is", null)
    .not("batch_number", "is", null);

  const groups = new Map<
    string,
    { sku: string; batch: string; product: string | null; complaints: { id: string; case_number: string; title: string }[] }
  >();
  for (const row of data ?? []) {
    const key = `${row.sku}|${row.batch_number}`;
    const entry = groups.get(key) ?? {
      sku: row.sku as string,
      batch: row.batch_number as string,
      product: (row.product_name as string | null) ?? null,
      complaints: [],
    };
    entry.complaints.push({ id: row.id as string, case_number: row.case_number as string, title: row.title as string });
    groups.set(key, entry);
  }

  return [...groups.values()].filter((g) => g.complaints.length >= 2).sort((a, b) => b.complaints.length - a.complaints.length);
}
