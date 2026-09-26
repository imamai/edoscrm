import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getProductActions, getBatchesNeedingAttention } from "@/lib/data/product-actions";
import { getTenantMembers } from "@/lib/data/members";
import { ProductActionsClient } from "./product-actions-client";

export const metadata: Metadata = { title: "Product actions" };

export default async function ProductActionsPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const [actions, batches, canRequest, canApprove, members] = await Promise.all([
    getProductActions(session.tenant.id),
    getBatchesNeedingAttention(session.tenant.id),
    hasPermission(session.tenant.id, "product.action.request"),
    hasPermission(session.tenant.id, "product.action.approve"),
    getTenantMembers(session.tenant.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Product actions</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Holding, releasing, withdrawing or recalling a batch. Quality and Marketing Operations raise an action;
          Manufacturing decides it — the split the complaint brief sets out. Every decision keeps the complaints that
          prompted it.
        </p>
      </div>

      <ProductActionsClient
        actions={actions}
        batches={batches}
        canRequest={canRequest}
        canApprove={canApprove}
        memberName={Object.fromEntries(members.map((m) => [m.id, m.name]))}
      />
    </div>
  );
}
