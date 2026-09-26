import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role client.
 *
 * This bypasses every row-level security policy in the project — every other
 * product's tables included (see ARCHITECTURE.md §2). It exists for the one
 * thing that genuinely cannot be done as the signed-in user: creating the
 * `edoscrm_users` row and calling `edoscrm_provision_tenant` right after
 * `auth.signUp`, before a session cookie exists to run them as the user.
 *
 * Rules, because the cost of getting this wrong is every tenant's data:
 *
 *   * Never import this into a Client Component. `server-only` makes that a
 *     build error rather than a leak.
 *   * Never reach for it because a query was refused. A refusal is the
 *     policy working; fix the policy or the query.
 *   * Always check the caller's own permission on their own client first,
 *     then use this to carry out the action.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local and to Vercel.",
    );
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
