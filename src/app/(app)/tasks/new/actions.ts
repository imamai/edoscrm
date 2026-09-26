"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/data/session";
import { TABLES } from "@/lib/data/tables";

export async function createTask(formData: FormData) {
  const session = await resolveSession();
  if (session.kind !== "ok") return { ok: false as const, error: "Your session has expired." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium");
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const complaintId = String(formData.get("complaint_id") ?? "").trim();

  if (!title) return { ok: false as const, error: "Give the task a title." };

  const supabase = await createClient();
  const { error } = await supabase.from(TABLES.tasks).insert({
    tenant_id: session.tenant.id,
    title,
    description: description || null,
    priority,
    due_date: dueDate || null,
    complaint_id: complaintId || null,
    created_by: session.user.id,
  });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
