import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getTenantSettings,
  getCategories,
  getKpiTargets,
} from "@/lib/data/settings";
import { getSlaRules } from "@/lib/data/sla";
import { BackLink } from "@/components/ui/back-link";
import { EmptyState } from "@/components/ui/primitives";
import { RulesClient } from "./rules-client";

export const metadata: Metadata = { title: "Rules & categories" };

export default async function RulesPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  if (!(await hasPermission(session.tenant.id, "admin.settings.manage"))) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/settings" label="Settings" />
        <EmptyState
          title="You don't have permission to change these rules"
          description="Service levels, escalation thresholds and targets are set by a workspace administrator."
        />
      </div>
    );
  }

  const [settings, slaRules, categories, targets] = await Promise.all([
    getTenantSettings(session.tenant.id),
    getSlaRules(session.tenant.id),
    getCategories(session.tenant.id, true),
    getKpiTargets(session.tenant.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackLink href="/settings" label="Settings" />
        <h1 className="text-xl font-semibold text-ink">
          Rules &amp; categories
        </h1>
        <p className="text-sm text-ink-faint">
          How this workspace decides what is urgent, what counts as a pattern,
          and what good performance looks like. Everything here starts at the
          values the complaint brief specifies.
        </p>
      </div>

      <RulesClient
        settings={settings}
        slaRules={slaRules}
        categories={categories}
        targets={targets}
      />
    </div>
  );
}
