import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getMemberDetails, getRoles } from "@/lib/data/members";
import { BackLink } from "@/components/ui/back-link";
import { EmptyState } from "@/components/ui/primitives";
import { MembersClient } from "./members-client";

export const metadata: Metadata = { title: "Members & roles" };

export default async function MembersPage() {
  const session = await resolveSession();
  if (session.kind !== "ok") redirect("/");

  if (!(await hasPermission(session.tenant.id, "admin.users.manage"))) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/settings" label="Settings" />
        <EmptyState
          title="You don't have permission to manage members"
          description="Ask a workspace administrator if you need to invite someone or change what they can do."
        />
      </div>
    );
  }

  const [members, roles] = await Promise.all([getMemberDetails(session.tenant.id), getRoles(session.tenant.id)]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BackLink href="/settings" label="Settings" />
        <h1 className="text-xl font-semibold text-ink">Members &amp; roles</h1>
        <p className="text-sm text-ink-faint">
          Who is in this workspace and what each of them can do. The seven roles below match the functions the complaint
          process needs — Marketing Operations, Quality, Manufacturing, Sales, Finance, Leadership and Report Only.
        </p>
      </div>

      <MembersClient members={members} roles={roles} />
    </div>
  );
}
