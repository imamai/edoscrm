import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Thin wrapper over the RLS helper of the same name — lets a page decide
 * whether to render an action at all, instead of showing a control that
 * would just fail against the real policy when clicked. */
export async function hasPermission(tenantId: string, key: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("edoscrm_has_permission", {
    p_tenant_id: tenantId,
    p_permission_key: key,
  });
  return Boolean(data);
}
