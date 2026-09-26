import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";

export type Attachment = {
  id: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  created_at: string;
};

export type Communication = {
  id: string;
  actor_id: string | null;
  direction: "outbound" | "inbound";
  channel: string;
  message: string;
  created_at: string;
};

export type CompensationType = "hamper" | "credit_note" | "other";
export type CompensationStatus = "requested" | "approved" | "fulfilled" | "declined";

export type Compensation = {
  id: string;
  type: CompensationType;
  amount_cents: number | null;
  status: CompensationStatus;
  requested_by: string | null;
  approved_by: string | null;
  fulfilled_at: string | null;
  created_at: string;
};

export async function getAttachments(complaintId: string): Promise<Attachment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.complaintAttachments)
    .select("id, file_name, storage_path, content_type, created_at")
    .eq("complaint_id", complaintId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCommunications(complaintId: string): Promise<Communication[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.complaintCommunications)
    .select("id, actor_id, direction, channel, message, created_at")
    .eq("complaint_id", complaintId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getCompensations(complaintId: string): Promise<Compensation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.complaintCompensations)
    .select("id, type, amount_cents, status, requested_by, approved_by, fulfilled_at, created_at")
    .eq("complaint_id", complaintId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type TenantCompensation = Compensation & { complaint_id: string; case_number: string; title: string };

/** Every compensation request tenant-wide, for the Reports page — brief §9
 * "trade credit notes must... remain traceable to the complaint case", so
 * this always carries the case number and title alongside the record. */
export async function getAllCompensations(tenantId: string): Promise<TenantCompensation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from(TABLES.complaintCompensations)
    .select("id, complaint_id, type, amount_cents, status, requested_by, approved_by, fulfilled_at, created_at, edoscrm_complaints(case_number, title)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => {
    const complaint = r.edoscrm_complaints as unknown as { case_number: string; title: string } | null;
    return {
      id: r.id,
      complaint_id: r.complaint_id,
      case_number: complaint?.case_number ?? "",
      title: complaint?.title ?? "",
      type: r.type,
      amount_cents: r.amount_cents,
      status: r.status,
      requested_by: r.requested_by,
      approved_by: r.approved_by,
      fulfilled_at: r.fulfilled_at,
      created_at: r.created_at,
    };
  });
}
