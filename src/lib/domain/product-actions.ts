// Plain data, no "server-only" — importable from a client component without
// dragging the server Supabase client into the browser bundle. Same reasoning
// as lib/domain/categories.ts.

export type ProductActionKind = "hold" | "release" | "withdrawal" | "recall";
export type ProductActionStatus = "requested" | "approved" | "declined";

export const ACTION_LABEL: Record<ProductActionKind, string> = {
  hold: "Hold",
  release: "Release",
  withdrawal: "Withdrawal",
  recall: "Recall",
};

export type ProductAction = {
  id: string;
  tenant_id: string;
  sku: string | null;
  batch_number: string | null;
  product_name: string | null;
  action: ProductActionKind;
  reason: string;
  status: ProductActionStatus;
  decision_note: string | null;
  complaint_ids: string[];
  requested_by: string | null;
  approved_by: string | null;
  decided_at: string | null;
  created_at: string;
};
