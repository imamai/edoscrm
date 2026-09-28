"use server";

import { createClient } from "@/lib/supabase/server";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * The manual path into a workspace, for an account that arrived here without
 * one. `edoscrm_provision_tenant` runs as the caller and makes them its
 * owner, so there is no way to attach yourself to somebody else's tenant
 * through this form.
 */
export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("tenant_name") ?? "").trim();
  if (!name) return { ok: false as const, error: "Enter a name for your organisation." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("edoscrm_provision_tenant", {
    p_tenant_name: name,
    p_tenant_slug: slugify(name),
  });

  if (error) return { ok: false as const, error: "We couldn't create your workspace. Please try again." };
  return { ok: true as const };
}
