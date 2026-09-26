import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

export type Notification = {
  id: string;
  complaint_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};

export async function getNotifications(userId: string, limit = 20): Promise<Notification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.notifications)
    .select("id, complaint_id, message, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from(TABLES.notifications)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

/**
 * The in-app half of the brief's §6 "Notifications" requirement — no
 * transactional email provider is configured for this project, so this is
 * what actually fires today. Silently no-ops per recipient on failure
 * (never blocks the caller's real write — a missed notification is a lot
 * cheaper than a failed complaint save).
 */
export async function notifyUsers(tenantId: string, userIds: string[], message: string, complaintId?: string) {
  if (userIds.length === 0) return;
  const supabase = await createClient();
  await supabase.from(TABLES.notifications).insert(
    [...new Set(userIds)].map((userId) => ({
      tenant_id: tenantId,
      user_id: userId,
      complaint_id: complaintId ?? null,
      message,
    })),
  );
}

/** Everyone in the tenant holding a given permission — used to notify
 * "Marketing Operations" / "Quality" as roles rather than named people,
 * matching the brief's tier-based notification rules (§"Required
 * notifications and approvals"). */
export async function usersWithPermission(tenantId: string, permissionKey: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: permission } = await supabase.from(TABLES.permissions).select("id").eq("key", permissionKey).maybeSingle();
  if (!permission) return [];

  const { data: rolePerms } = await supabase.from(TABLES.rolePermissions).select("role_id").eq("permission_id", permission.id);
  const roleIds = (rolePerms ?? []).map((r) => r.role_id as string);
  if (roleIds.length === 0) return [];

  const { data: userRoles } = await supabase
    .from(TABLES.userRoles)
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("role_id", roleIds);
  return [...new Set((userRoles ?? []).map((r) => r.user_id as string))];
}
