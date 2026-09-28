import "server-only";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
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
 * Brief §6 "Notifications" — immediate, in-app and (now that RESEND_API_KEY
 * is configured) real email. The in-app row is the reliable half: it's
 * written first and unconditionally, and email sending happens after, one
 * per recipient, best-effort — a bounced or slow email never blocks the
 * caller's real write (a missed email is a lot cheaper than a failed
 * complaint save), and a recipient with no email on file, or a provider
 * outage, still gets the in-app notification either way.
 */
export async function notifyUsers(tenantId: string, userIds: string[], message: string, complaintId?: string) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const supabase = await createClient();

  await supabase.from(TABLES.notifications).insert(
    ids.map((userId) => ({
      tenant_id: tenantId,
      user_id: userId,
      complaint_id: complaintId ?? null,
      message,
    })),
  );

  const { data: recipients } = await supabase.from(TABLES.users).select("id, email, full_name").in("id", ids);
  if (!recipients || recipients.length === 0) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const link = complaintId && siteUrl ? `${siteUrl}/complaints/${complaintId}` : null;
  const html = [
    `<p>${escapeHtml(message)}</p>`,
    link ? `<p><a href="${link}">Open it in EDOS CRM</a></p>` : null,
  ]
    .filter(Boolean)
    .join("");

  await Promise.all(
    recipients
      .filter((r) => r.email)
      .map((r) =>
        sendEmail({ to: r.email as string, subject: `EDOS CRM: ${message}`, html }).catch(() => {
          // Best-effort — the in-app notification above is already saved.
        }),
      ),
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
