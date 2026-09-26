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
