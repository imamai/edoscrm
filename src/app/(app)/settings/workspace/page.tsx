import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { WorkspaceSettingsForm } from "./workspace-settings-form";

export const metadata: Metadata = { title: "Workspace" };

/**
 * First cut of Settings (ARCHITECTURE.md §14's deferred "admin-configuration
 * UI" bucket) — the fields a workspace actually has today (name, timezone,
 * currency). Member/role management reuses the same admin.org.manage
 * permission but is real, separate scope — not built here.
 */
export default async function WorkspaceSettingsPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  const canManage = await hasPermission(session.tenant.id, "admin.org.manage");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Workspace</h1>
        <p className="text-sm text-ink-faint">
          Workspace details for {session.tenant.name}.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Workspace</h2>
        {!canManage && (
          <p className="mb-3 text-sm text-ink-faint">
            You can view these details. Ask a tenant administrator to make
            changes.
          </p>
        )}
        <WorkspaceSettingsForm tenant={session.tenant} canManage={canManage} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Plan</h2>
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-faint">Plan</dt>
            <dd className="text-ink capitalize">{session.tenant.plan}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-faint">Status</dt>
            <dd className="text-ink capitalize">{session.tenant.status}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-faint">Workspace slug</dt>
            <dd className="text-ink">{session.tenant.slug}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
