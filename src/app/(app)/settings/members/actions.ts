"use server";

import { revalidatePath } from "next/cache";
import { resolveSession } from "@/lib/data/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  inviteMember,
  setMemberRoles,
  setMemberStatus,
  getMemberDetails,
} from "@/lib/data/members";
import { writeAudit } from "@/lib/data/audit";

/**
 * Member administration.
 *
 * Every action re-checks the permission on the server. The nav hides these
 * destinations from people who cannot use them, but hiding a link is tidiness,
 * not access control — the check that matters is this one, plus the RLS policy
 * underneath it.
 *
 * All three write an audit entry: who was let into the workspace, who was
 * given which role, and who was suspended are exactly the questions an audit
 * is for.
 */

export async function inviteMemberAction(email: string, roleIds: string[]) {
  const session = await resolveSession();
  if (session.kind !== "ok")
    return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "admin.users.manage"))) {
    return {
      ok: false as const,
      error: "You don't have permission to invite people to this workspace.",
    };
  }

  const result = await inviteMember(
    session.tenant.id,
    email,
    session.user.id,
    roleIds,
  );
  if (!result.ok) return result;

  await writeAudit({
    tenantId: session.tenant.id,
    actorId: session.user.id,
    action: result.status === "invited" ? "member.invited" : "member.added",
    entityType: "member",
    after: { email: email.trim().toLowerCase(), roles: roleIds.length },
  });

  revalidatePath("/settings/members");
  // Said plainly either way. The membership is real whether or not the
  // message got out, and an admin who is not told otherwise will assume it
  // arrived, then wait for somebody who never heard from us.
  return { ok: true as const, status: result.status, mailed: result.mailed };
}

export async function setMemberRolesAction(userId: string, roleIds: string[]) {
  const session = await resolveSession();
  if (session.kind !== "ok")
    return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "admin.users.manage"))) {
    return {
      ok: false as const,
      error: "You don't have permission to change roles.",
    };
  }

  const members = await getMemberDetails(session.tenant.id);
  const target = members.find((m) => m.user_id === userId);
  if (!target)
    return {
      ok: false as const,
      error: "That person isn't a member of this workspace.",
    };

  // Don't let the last administrator remove their own administrator role and
  // lock the workspace out of its own settings.
  const adminRoleIds = new Set(
    members.flatMap((m) =>
      m.roles.filter((r) => r.name === "Tenant Administrator").map((r) => r.id),
    ),
  );
  const adminRoleId = [...adminRoleIds][0];
  if (adminRoleId) {
    const wasAdmin = target.roles.some((r) => r.id === adminRoleId);
    const willBeAdmin = roleIds.includes(adminRoleId);
    if (wasAdmin && !willBeAdmin) {
      const remainingAdmins = members.filter(
        (m) =>
          m.user_id !== userId &&
          m.status === "active" &&
          m.roles.some((r) => r.id === adminRoleId),
      ).length;
      if (remainingAdmins === 0) {
        return {
          ok: false as const,
          error:
            "This is the only administrator. Give someone else the role first.",
        };
      }
    }
  }

  const result = await setMemberRoles(session.tenant.id, userId, roleIds);
  if (!result.ok) return result;

  await writeAudit({
    tenantId: session.tenant.id,
    actorId: session.user.id,
    action: "member.roles.changed",
    entityType: "member",
    entityId: userId,
    before: { roles: target.roles.map((r) => r.name) },
    after: { roleIds },
  });

  revalidatePath("/settings/members");
  return { ok: true as const };
}

export async function setMemberStatusAction(
  userId: string,
  status: "active" | "suspended",
) {
  const session = await resolveSession();
  if (session.kind !== "ok")
    return { ok: false as const, error: "Your session has expired." };
  if (!(await hasPermission(session.tenant.id, "admin.users.manage"))) {
    return {
      ok: false as const,
      error: "You don't have permission to change access.",
    };
  }
  if (userId === session.user.id && status === "suspended") {
    return { ok: false as const, error: "You can't suspend your own access." };
  }

  const result = await setMemberStatus(session.tenant.id, userId, status);
  if (!result.ok) return result;

  await writeAudit({
    tenantId: session.tenant.id,
    actorId: session.user.id,
    action: status === "suspended" ? "member.suspended" : "member.reinstated",
    entityType: "member",
    entityId: userId,
    after: { status },
  });

  revalidatePath("/settings/members");
  return { ok: true as const };
}
