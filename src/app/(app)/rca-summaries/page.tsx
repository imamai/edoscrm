import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getRcaSummaries } from "@/lib/data/rca-summaries";
import { EmptyState } from "@/components/ui/primitives";
import { SummariesClient } from "./summaries-client";

export const metadata: Metadata = { title: "RCA summaries" };

export default async function RcaSummariesPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const [canView, canApprove, canShare] = await Promise.all([
    hasPermission(session.tenant.id, "investigations.manage"),
    hasPermission(session.tenant.id, "rca.summary.approve"),
    hasPermission(session.tenant.id, "rca.summary.share"),
  ]);

  if (!canView && !canApprove && !canShare) {
    return (
      <EmptyState
        title="You don't have access to investigation summaries"
        description="Summaries of root-cause analysis are restricted to Quality and Marketing Operations."
      />
    );
  }

  const summaries = await getRcaSummaries(session.tenant.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">RCA summaries</h1>
        <p className="mt-1 text-sm text-ink-faint">
          The external version of an investigation: what was found and what was done, written for someone outside the
          business. Raw investigation notes stay internal and are never sent — only an approved summary can leave, and
          every send is logged.
        </p>
      </div>

      <SummariesClient summaries={summaries} canApprove={canApprove} canShare={canShare} />
    </div>
  );
}
