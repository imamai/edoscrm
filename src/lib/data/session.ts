import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

export type SessionTenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  timezone: string;
  currency: string;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
};

export type SessionResult =
  | { kind: "anon" }
  | { kind: "no_tenant"; user: SessionUser }
  | { kind: "ok"; user: SessionUser; tenant: SessionTenant; isPlatformAdmin: boolean };

/**
 * The one place a page or layout asks "who is this and what tenant are they
 * in". Settles a just-signed-up user's profile row and any pending invite
 * (`edoscrm_ensure_profile`), then resolves their current tenant — their
 * last one if they have it, otherwise whichever active membership comes
 * first. Route protection lives at each call site (redirect on `"anon"`),
 * not in middleware, so it can't be bypassed by a matcher that misses a path.
 */
export async function resolveSession(): Promise<SessionResult> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { kind: "anon" };

  await supabase.rpc("edoscrm_ensure_profile");

  const { data: profile } = await supabase
    .from(TABLES.users)
    .select("id, email, full_name, last_tenant_id")
    .eq("id", authUser.id)
    .maybeSingle();

  const user: SessionUser = {
    id: authUser.id,
    email: profile?.email ?? authUser.email ?? "",
    fullName: profile?.full_name ?? null,
  };

  let tenantId = profile?.last_tenant_id ?? null;

  if (!tenantId) {
    const { data: membership } = await supabase
      .from(TABLES.memberships)
      .select("tenant_id")
      .eq("user_id", authUser.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    tenantId = membership?.tenant_id ?? null;
  }

  if (!tenantId) return { kind: "no_tenant", user };

  const { data: tenant } = await supabase
    .from(TABLES.tenants)
    .select("id, name, slug, plan, status, timezone, currency")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return { kind: "no_tenant", user };

  const { data: platformAdmin } = await supabase
    .from(TABLES.platformAdmins)
    .select("user_id")
    .eq("user_id", authUser.id)
    .maybeSingle();

  return { kind: "ok", user, tenant, isPlatformAdmin: Boolean(platformAdmin) };
}
