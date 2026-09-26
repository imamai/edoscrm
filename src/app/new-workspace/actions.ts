"use server";

import { createClient } from "@/lib/supabase/server";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false as const, error: "Enter a workspace name." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("edoscrm_provision_tenant", {
    p_tenant_name: name,
    p_tenant_slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
  });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
