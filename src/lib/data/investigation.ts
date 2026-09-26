import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TABLES } from "@/lib/data/tables";
import type { RootCauseCategory, CapaStatus } from "@/lib/domain/investigation";

export type Investigation = {
  id: string;
  complaint_id: string;
  findings: string;
  investigator_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RootCause = {
  id: string;
  complaint_id: string;
  category: RootCauseCategory;
  description: string;
  created_at: string;
  updated_at: string;
};

export type Capa = {
  id: string;
  complaint_id: string;
  corrective_action: string;
  preventive_action: string | null;
  owner_id: string | null;
  due_date: string | null;
  status: CapaStatus;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
};

export async function getQualityRecords(complaintId: string): Promise<{
  investigation: Investigation | null;
  rootCause: RootCause | null;
  capa: Capa | null;
}> {
  const supabase = await createClient();
  const [investigation, rootCause, capa] = await Promise.all([
    supabase.from(TABLES.investigations).select("*").eq("complaint_id", complaintId).maybeSingle(),
    supabase.from(TABLES.rootCauses).select("*").eq("complaint_id", complaintId).maybeSingle(),
    supabase.from(TABLES.capas).select("*").eq("complaint_id", complaintId).maybeSingle(),
  ]);
  return {
    investigation: investigation.data,
    rootCause: rootCause.data,
    capa: capa.data,
  };
}
