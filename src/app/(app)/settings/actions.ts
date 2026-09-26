"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { TABLES } from "@/lib/data/tables";

export async function updateWorkspace(formData: FormData) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };

  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const accentColor = String(formData.get("accent_color") ?? "").trim();

  if (!name) return { ok: false as const, error: "The workspace needs a name." };
  if (!timezone) return { ok: false as const, error: "Choose a timezone." };
  if (currency.length !== 3) return { ok: false as const, error: "Currency should be a 3-letter code, e.g. KES." };

  const branding = { ...session.tenant.branding, accent_color: /^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : null };

  const supabase = await createClient();
  // RLS (edoscrm_tenants_update) is the real gate here — it only lets this
  // through for someone holding admin.org.manage on this tenant. The check
  // just gives a clean error instead of a raw Postgres denial.
  const { error } = await supabase.from(TABLES.tenants).update({ name, timezone, currency, branding }).eq("id", session.tenant.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings");
  return { ok: true as const };
}

/** Called after the browser has already uploaded the file straight to
 * Storage (see logo-upload.tsx) — this only records the resulting public
 * URL. Binary bytes never pass through a server action. */
export async function setTenantLogo(logoUrl: string | null): Promise<{ error: string | null }> {
  const session = await resolveSession();
  if (session.kind !== "ok") return { error: "Your session has expired." };

  const branding = { ...session.tenant.branding, logo_url: logoUrl };
  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.tenants).update({ branding }).eq("id", session.tenant.id);
  if (error) return { error: "Couldn't save the logo." };

  revalidatePath("/settings");
  return { error: null };
}
