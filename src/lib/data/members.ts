import "server-only";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TABLES } from "@/lib/data/tables";
import { sendEmail, teamInviteEmail } from "@/lib/email";

export type Member = { id: string; name: string };

/** Everyone active in the tenant, for assignment dropdowns — name falls
 * back to email since full_name is optional on signup. */
export async function getTenantMembers(tenantId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from(TABLES.memberships)
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  const userIds = (memberships ?? []).map((m) => m.user_id as string);
  if (userIds.length === 0) return [];

  const { data: users } = await supabase.from(TABLES.users).select("id, full_name, email").in("id", userIds);
  return (users ?? [])
    .map((u) => ({ id: u.id as string, name: (u.full_name as string | null) ?? (u.email as string) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ *
 * Member administration.
 *
 * The seven roles the brief defines have existed and been enforced since the
 * schema was built; what was missing was any way to hand them out. Without
 * this, a workspace could not separate Marketing Operations from Quality from
 * Finance — so tier-based notification had nobody to notify, and every
 * requirement resting on "a named investigating function" was unreachable.
 * ------------------------------------------------------------------ */

export type Role = { id: string; name: string; description: string | null; is_system: boolean };

export type MemberDetail = {
  user_id: string;
  email: string;
  full_name: string | null;
  status: string;
  last_active_at: string | null;
  created_at: string;
  roles: { id: string; name: string }[];
};

export async function getRoles(tenantId: string): Promise<Role[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.roles)
    .select("id, name, description, is_system")
    .eq("tenant_id", tenantId)
    .order("name");
  return (data ?? []) as Role[];
}

export async function getMemberDetails(tenantId: string): Promise<MemberDetail[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from(TABLES.memberships)
    .select("user_id, status, last_active_at, created_at")
    .eq("tenant_id", tenantId);
  if (!memberships?.length) return [];

  const userIds = memberships.map((m) => m.user_id as string);
  const [{ data: users }, { data: userRoles }, { data: roles }] = await Promise.all([
    supabase.from(TABLES.users).select("id, email, full_name").in("id", userIds),
    supabase.from(TABLES.userRoles).select("user_id, role_id").eq("tenant_id", tenantId).in("user_id", userIds),
    supabase.from(TABLES.roles).select("id, name").eq("tenant_id", tenantId),
  ]);

  const userById = new Map((users ?? []).map((u) => [u.id as string, u]));
  const roleById = new Map((roles ?? []).map((r) => [r.id as string, r.name as string]));
  const rolesByUser = new Map<string, { id: string; name: string }[]>();
  for (const ur of userRoles ?? []) {
    const list = rolesByUser.get(ur.user_id as string) ?? [];
    list.push({ id: ur.role_id as string, name: roleById.get(ur.role_id as string) ?? "Unknown role" });
    rolesByUser.set(ur.user_id as string, list);
  }

  return memberships
    .map((m) => {
      const u = userById.get(m.user_id as string);
      return {
        user_id: m.user_id as string,
        email: (u?.email as string) ?? "",
        full_name: (u?.full_name as string | null) ?? null,
        status: m.status as string,
        last_active_at: (m.last_active_at as string | null) ?? null,
        created_at: m.created_at as string,
        roles: (rolesByUser.get(m.user_id as string) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));
}

/** The address this request arrived on, so the invitation comes back here. */
async function inviteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Invite someone by email.
 *
 * Uses the admin client because the invitee has no account yet and therefore
 * no RLS identity of their own — the same reasoning as the public intake
 * endpoint. Caller must have checked admin.users.manage first; this does not
 * check permissions itself.
 *
 * An existing account is added to the workspace directly rather than being
 * sent through a signup they have already completed.
 */
export async function inviteMember(
  tenantId: string,
  email: string,
  invitedBy: string,
  roleIds: string[],
): Promise<{ ok: true; status: "invited" | "added" } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const normalised = email.trim().toLowerCase();
  if (!normalised) return { ok: false, error: "An email address is required." };

  const { data: existing } = await admin.from(TABLES.users).select("id").eq("email", normalised).maybeSingle();
  let userId = existing?.id as string | undefined;
  let status: "invited" | "added" = "added";

  if (!userId) {
    // generateLink creates the account and hands back the invitation token
    // WITHOUT sending anything, which leaves the message to us — the same
    // reason sign-up and password reset do it this way (see lib/email.ts).
    // inviteUserByEmail would send Supabase's stock template from the
    // project's own address instead.
    const base = await inviteOrigin();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email: normalised,
      options: { redirectTo: `${base}/auth/callback?next=/update-password` },
    });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? "Could not send that invitation." };
    }
    userId = data.user.id;
    status = "invited";
    // The profile row normally appears when someone signs in; create it now so
    // they show in the member list before they have accepted.
    await admin.from(TABLES.users).upsert({ id: userId, email: normalised }, { onConflict: "id" });

    const tokenHash = data.properties?.hashed_token;
    if (tokenHash) {
      const { data: tenant } = await admin
        .from(TABLES.tenants)
        .select("name")
        .eq("id", tenantId)
        .maybeSingle();
      const { data: inviter } = await admin
        .from(TABLES.users)
        .select("full_name")
        .eq("id", invitedBy)
        .maybeSingle();

      const link = `${base}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=invite&next=/update-password`;
      const sent = await sendEmail({
        to: normalised,
        ...teamInviteEmail({
          link,
          workspaceName: (tenant?.name as string) ?? "your workspace",
          invitedBy: (inviter?.full_name as string) ?? null,
        }),
      });
      // The membership below is the thing that matters; a failed send is worth
      // a log, not a rollback. They can still be let in with a password reset.
      if (!sent.sent) console.error("EDOS CRM invitation email failed:", sent.reason);
    }
  }

  const { error: memberError } = await admin
    .from(TABLES.memberships)
    .upsert({ user_id: userId, tenant_id: tenantId, status: "active", invited_by: invitedBy }, { onConflict: "user_id,tenant_id" });
  if (memberError) return { ok: false, error: memberError.message };

  if (roleIds.length) {
    const { error: roleError } = await admin
      .from(TABLES.userRoles)
      .upsert(
        roleIds.map((role_id) => ({ user_id: userId!, tenant_id: tenantId, role_id, scope_type: "tenant" })),
        { onConflict: "user_id,tenant_id,role_id" },
      );
    if (roleError) return { ok: false, error: roleError.message };
  }

  return { ok: true, status };
}

/** Replace a member's roles wholesale — simpler to reason about than a set of
 * add/remove deltas, and it is what the screen actually submits. */
export async function setMemberRoles(tenantId: string, userId: string, roleIds: string[]) {
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from(TABLES.userRoles)
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (deleteError) return { ok: false as const, error: deleteError.message };

  if (roleIds.length) {
    const { error } = await supabase
      .from(TABLES.userRoles)
      .insert(roleIds.map((role_id) => ({ user_id: userId, tenant_id: tenantId, role_id, scope_type: "tenant" })));
    if (error) return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

/** Membership is suspended, never deleted — the cases someone handled keep
 * pointing at a real person, and the audit trail stays readable. */
export async function setMemberStatus(tenantId: string, userId: string, status: "active" | "suspended") {
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.memberships)
    .update({ status })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/** How many people still hold a given permission — used to stop the last
 * administrator locking themselves out of their own workspace. */
export async function countMembersWithRole(tenantId: string, roleName: string): Promise<number> {
  const supabase = await createClient();
  const { data: role } = await supabase
    .from(TABLES.roles)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", roleName)
    .maybeSingle();
  if (!role) return 0;
  const { count } = await supabase
    .from(TABLES.userRoles)
    .select("user_id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role_id", role.id as string);
  return count ?? 0;
}
