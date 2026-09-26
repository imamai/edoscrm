import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import type { Complaint } from "@/lib/data/complaints";

/**
 * The complainant as a record rather than three text fields on a case.
 *
 * Without this, the same person complaining three times is three unrelated
 * cases with three spellings of their name, and no screen can answer "has this
 * customer complained before" — which is the question that separates a CRM
 * from a case tracker. It is also what duplicate detection needs to exist
 * before it can be built.
 */

export type ContactType = "consumer" | "trade" | "distributor";

export type Contact = {
  id: string;
  tenant_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  type: ContactType;
  notes: string | null;
  created_at: string;
};

/** Digits only, so "+254 712 345 678" and "0712345678" match. Kenyan mobile
 * numbers are written both ways constantly; the stored value keeps whatever
 * was typed and this is only the comparison key. */
function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits || null;
}

function emailKey(email: string | null | undefined): string | null {
  const v = (email ?? "").trim().toLowerCase();
  return v || null;
}

/**
 * Find the contact this complainant already is, or create them.
 *
 * Email is the stronger key and wins; phone is the fallback, because plenty of
 * complaints arrive by phone with no email at all. A complaint with neither
 * gets no contact — an anonymous walk-in is a real case, and inventing a
 * contact record for it would pollute the customer list.
 */
export async function findOrCreateContact(
  tenantId: string,
  details: { name?: string | null; email?: string | null; phone?: string | null; type?: ContactType },
): Promise<string | null> {
  const ek = emailKey(details.email);
  const pk = phoneKey(details.phone);
  if (!ek && !pk) return null;

  const supabase = await createClient();

  if (ek) {
    const { data } = await supabase.from(TABLES.contacts).select("id").eq("tenant_id", tenantId).eq("email_key", ek).maybeSingle();
    if (data) return data.id as string;
  }
  if (pk) {
    const { data } = await supabase.from(TABLES.contacts).select("id").eq("tenant_id", tenantId).eq("phone_key", pk).maybeSingle();
    if (data) return data.id as string;
  }

  const { data: created, error } = await supabase
    .from(TABLES.contacts)
    .insert({
      tenant_id: tenantId,
      full_name: details.name ?? null,
      email: details.email ?? null,
      phone: details.phone ?? null,
      type: details.type ?? "consumer",
    })
    .select("id")
    .maybeSingle();

  // A concurrent insert of the same person loses the unique-index race; the
  // right answer is still "use the row that won", not to fail the complaint.
  if (error) {
    if (ek) {
      const { data } = await supabase.from(TABLES.contacts).select("id").eq("tenant_id", tenantId).eq("email_key", ek).maybeSingle();
      if (data) return data.id as string;
    }
    if (pk) {
      const { data } = await supabase.from(TABLES.contacts).select("id").eq("tenant_id", tenantId).eq("phone_key", pk).maybeSingle();
      if (data) return data.id as string;
    }
    return null;
  }
  return (created?.id as string) ?? null;
}

export async function getContact(tenantId: string, id: string): Promise<Contact | null> {
  const supabase = await createClient();
  const { data } = await supabase.from(TABLES.contacts).select("*").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  return data as Contact | null;
}

export async function getContacts(tenantId: string, search?: string): Promise<Contact[]> {
  const supabase = await createClient();
  let q = supabase.from(TABLES.contacts).select("*").eq("tenant_id", tenantId);
  const term = (search ?? "").trim();
  if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data } = await q.order("full_name", { nullsFirst: false }).limit(500);
  return (data ?? []) as Contact[];
}

/** Every other case this complainant has raised — the history panel on a case. */
export async function getContactComplaints(tenantId: string, contactId: string, excludeComplaintId?: string): Promise<Complaint[]> {
  const supabase = await createClient();
  let q = supabase.from(TABLES.complaints).select("*").eq("tenant_id", tenantId).eq("contact_id", contactId);
  if (excludeComplaintId) q = q.neq("id", excludeComplaintId);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as Complaint[];
}

export async function updateContact(
  tenantId: string,
  id: string,
  values: { full_name?: string | null; email?: string | null; phone?: string | null; type?: ContactType; notes?: string | null },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES.contacts)
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
