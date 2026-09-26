import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

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
