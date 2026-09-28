"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/provision";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // Supabase answers the same for a wrong password and an unknown address,
  // which is correct — confirming which one exists would leak it.
  if (error) return { ok: false as const, error: "That email or password is incorrect." };

  // Signing in may be the first moment a session has existed for this account
  // — somebody who never opened the confirmation email, for instance — which
  // is when the workspace they signed up for gets created.
  await ensureWorkspace(supabase, data.user);

  return { ok: true as const };
}
