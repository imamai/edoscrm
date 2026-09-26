"use server";

import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) return { ok: false as const, error: error.message };

  // Workspace creation happens on /new-workspace, once there's a session to
  // run edoscrm_provision_tenant as — which isn't guaranteed here if the
  // project requires email confirmation.
  return { ok: true as const, confirmed: Boolean(data.session) };
}
